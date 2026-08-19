/**
 * Sky-map accuracy harness — run without a phone.
 *
 * Uses the home observer (Nashville) plus a date to:
 *   1. Place Sun / Moon / bright stars via astronomy-engine
 *   2. Cross-check with an independent hour-angle formula
 *   3. Simulate an iPhone DeviceOrientationEvent looking at a target
 *      and measure how far the look vector misses
 *
 * `npx vitest run lib/skyAccuracy.test.ts` prints a live home-sky dump.
 */

import { Body, Observer, SearchHourAngle } from "astronomy-engine";
import { cameraAzimuthAltitude } from "./deviceAttitude";
import {
  HOME_ALT_M,
  HOME_DECLINATION_DEG,
  HOME_LAT,
  HOME_LON,
  HOME_OBSERVER,
} from "./observerHome";
import {
  resetOrientationCalibration,
  resolveDeviceAlphaDeg,
  setMagneticDeclinationDeg,
  setUserAzimuthOffsetDeg,
} from "./orientationCalibration";
import { BRIGHT_STARS } from "./brightStars";
import {
  bodyEquatorHorizon,
  raDecToAltAz,
  type HorizonCoords,
} from "./skyPositions";
import {
  altAzToEnu,
  buildStableViewBasis,
  createSphericalSkyProjector,
  deviceOrientationToViewEnu,
  enuToAltAz,
} from "./sphericalView";
import { lstDeg } from "./starmap";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export { HOME_OBSERVER, HOME_LAT, HOME_LON, HOME_ALT_M, HOME_DECLINATION_DEG };

export function shortestDeg(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function angularSeparationDeg(
  az1: number,
  alt1: number,
  az2: number,
  alt2: number,
): number {
  const a1 = alt1 * RAD;
  const a2 = alt2 * RAD;
  const dAz = shortestDeg(az1, az2) * RAD;
  const cosD = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dAz);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) * DEG;
}

/**
 * Independent alt/az from of-date RA/Dec (no refraction).
 * Azimuth: 0 = north, 90 = east. Matches astronomy-engine Horizon.
 */
export function hourAngleAltAz(
  date: Date,
  latDeg: number,
  lonDeg: number,
  raHours: number,
  decDeg: number,
): HorizonCoords {
  const lst = lstDeg(date, lonDeg);
  const ha = (lst - raHours * 15) * RAD; // west-positive hour angle
  const lat = latDeg * RAD;
  const dec = decDeg * RAD;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;
  // ENU: east = −cos(δ) sin(H), north = cos(φ) sin(δ) − sin(φ) cos(δ) cos(H)
  const east = -Math.cos(dec) * Math.sin(ha);
  const north = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(ha);
  let az = Math.atan2(east, north) * DEG;
  if (az < 0) az += 360;
  return { alt, az };
}

export type SkyTarget = {
  id: string;
  name: string;
  az: number;
  alt: number;
  kind: "body" | "star";
};

export function homeSkyTargets(date: Date): SkyTarget[] {
  const { lat, lon, altM } = HOME_OBSERVER;
  const bodies: SkyTarget[] = (["sun", "moon", "venus", "mars", "jupiter", "saturn"] as const).map(id => {
    const body =
      id === "sun" ? Body.Sun
      : id === "moon" ? Body.Moon
      : id === "venus" ? Body.Venus
      : id === "mars" ? Body.Mars
      : id === "jupiter" ? Body.Jupiter
      : Body.Saturn;
    const pos = bodyEquatorHorizon(body, date, lat, lon, altM);
    return { id, name: id[0]!.toUpperCase() + id.slice(1), az: pos.az, alt: pos.alt, kind: "body" };
  });
  const stars: SkyTarget[] = ["polaris", "vega", "altair", "deneb", "arcturus", "sirius"]
    .map(id => BRIGHT_STARS.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map(s => {
      const hor = raDecToAltAz(date, lat, lon, s.ra, s.dec, altM, "j2000");
      return { id: s.id, name: s.name, az: hor.az, alt: hor.alt, kind: "star" as const };
    });
  return [...bodies, ...stars];
}

export function sunOnMeridian(date: Date): { time: Date; az: number; alt: number } {
  const observer = new Observer(HOME_LAT, HOME_LON, HOME_ALT_M);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const hit = SearchHourAngle(Body.Sun, observer, 0, start);
  const time = hit.time.date;
  const pos = bodyEquatorHorizon(Body.Sun, time, HOME_LAT, HOME_LON, HOME_ALT_M);
  return { time, az: pos.az, alt: pos.alt };
}

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** First upright sample locks iOS α-offset, then pitch to the target. */
export function simulateIosLookAt(
  trueAz: number,
  trueAlt: number,
  declinationDeg = HOME_DECLINATION_DEG,
): CompassEvent {
  resetOrientationCalibration();
  setMagneticDeclinationDeg(declinationDeg);
  setUserAzimuthOffsetDeg(0);

  const magHeading = ((trueAz - declinationDeg) % 360 + 360) % 360;
  const deviceAlpha = 40;
  // webkit is the magnetic heading of the camera while upright — not α + heading.
  const webkitUpright = magHeading;

  // Calibrate at the horizon, same yaw — webkit = magnetic heading of the camera.
  const upright = {
    alpha: deviceAlpha,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: webkitUpright,
    absolute: false,
  } as CompassEvent;
  // Force offset lock (pitch-steady requires a previous β).
  resolveDeviceAlphaDeg(upright);
  resolveDeviceAlphaDeg(upright);

  const beta = Math.max(0.5, Math.min(179.5, 90 + trueAlt));
  return {
    alpha: deviceAlpha,
    beta,
    // Leave the upright band so a lying webkit sample cannot refresh the offset.
    gamma: 26,
    webkitCompassHeading: webkitUpright + 40,
    absolute: false,
  } as CompassEvent;
}

export function lookErrorDeg(
  event: DeviceOrientationEvent & { webkitCompassHeading?: number },
  targetAz: number,
  targetAlt: number,
): { lookAz: number; lookAlt: number; errorDeg: number } {
  const view = deviceOrientationToViewEnu(event);
  if (!view) return { lookAz: NaN, lookAlt: NaN, errorDeg: Infinity };
  const look = enuToAltAz(view);
  return {
    lookAz: look.az,
    lookAlt: look.alt,
    errorDeg: angularSeparationDeg(look.az, look.alt, targetAz, targetAlt),
  };
}

/** Object at the look direction must land on the canvas crosshair. */
export function projectTargetToCrosshair(
  lookAz: number,
  lookAlt: number,
  targetAz: number,
  targetAlt: number,
  width = 390,
  height = 844,
  fovAltHalf = 42,
): { x: number; y: number; dx: number; dy: number } {
  const basis = buildStableViewBasis(altAzToEnu(lookAz, lookAlt), null);
  const project = createSphericalSkyProjector(width, height, basis, 90, fovAltHalf);
  const [x, y] = project.toXY(targetAz, targetAlt);
  return { x, y, dx: x - width / 2, dy: y - height / 2 };
}

export function formatHomeSkyDump(date: Date): string {
  const targets = homeSkyTargets(date);
  const lines = [
    `DELPHI sky accuracy — ${HOME_OBSERVER.label}`,
    `observer ${HOME_LAT.toFixed(4)}N ${Math.abs(HOME_LON).toFixed(4)}W  alt ${HOME_ALT_M}m  decl ${HOME_DECLINATION_DEG}°`,
    `time ${date.toISOString()}`,
    "",
  ];
  for (const t of targets) {
    const vis = t.alt > 0 ? "up" : "down";
    lines.push(
      `${t.name.padEnd(10)}  az ${t.az.toFixed(1).padStart(6)}°  alt ${t.alt.toFixed(1).padStart(6)}°  ${vis}`,
    );
  }
  return lines.join("\n");
}

/** Matrix look (γ=0) for a true-north heading — used to prove Euler → ENU. */
export function matrixLookAtHeading(trueAz: number, trueAlt: number): HorizonCoords {
  const matrixAlpha = (360 - trueAz + 360) % 360;
  const beta = 90 + trueAlt;
  return cameraAzimuthAltitude(matrixAlpha, beta, 0);
}
