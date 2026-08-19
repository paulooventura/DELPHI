/**
 * Topocentric alt/az via astronomy-engine (cosinekitty/astronomy).
 * Sub-arcminute accuracy for Moon, Sun, and planets at a GPS fix.
 *
 * Horizon() expects equatorial-of-date (EQD). Star catalogs are J2000 (EQJ)
 * and must be precessed first — otherwise the field is ~0.4° off in 2026.
 */
import {
  Body,
  Equator,
  Horizon,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SphereFromVector,
  Spherical,
  VectorFromSphere,
  type FlexibleDateTime,
} from "astronomy-engine";

export type HorizonCoords = { alt: number; az: number };

export type EquatorialHorizon = HorizonCoords & {
  raHours: number;
  decDeg: number;
};

export type EquatorialFrame = "j2000" | "ofdate";

function makeObserver(latDeg: number, lonDeg: number, altM = 0): Observer {
  return new Observer(latDeg, lonDeg, Math.max(0, altM));
}

function makeTime(date: Date): FlexibleDateTime {
  return MakeTime(date);
}

/** J2000 RA/Dec → equatorial of date (hours / degrees). */
export function j2000ToOfDateRaDec(
  date: Date,
  raHours: number,
  decDeg: number,
): { raHours: number; decDeg: number } {
  const time = MakeTime(date);
  const eqj = VectorFromSphere(new Spherical(decDeg, raHours * 15, 1), time);
  const ofdate = SphereFromVector(RotateVector(Rotation_EQJ_EQD(time), eqj));
  let lon = ofdate.lon;
  if (lon < 0) lon += 360;
  return { raHours: lon / 15, decDeg: ofdate.lat };
}

/** RA (hours) + Dec (degrees) → altitude/azimuth at observer. */
export function raDecToAltAz(
  date: Date,
  latDeg: number,
  lonDeg: number,
  raHours: number,
  decDeg: number,
  altM = 0,
  frame: EquatorialFrame = "j2000",
): HorizonCoords {
  const time = makeTime(date);
  const observer = makeObserver(latDeg, lonDeg, altM);
  const eq =
    frame === "j2000" ? j2000ToOfDateRaDec(date, raHours, decDeg) : { raHours, decDeg };
  const hor = Horizon(time, observer, eq.raHours, eq.decDeg, "normal");
  return { alt: hor.altitude, az: hor.azimuth };
}

/** Solar-system body → equatorial + horizon at observer. */
export function bodyEquatorHorizon(
  body: Body,
  date: Date,
  latDeg: number,
  lonDeg: number,
  altM = 0,
): EquatorialHorizon {
  const time = makeTime(date);
  const observer = makeObserver(latDeg, lonDeg, altM);
  const eq = Equator(body, time, observer, true, true);
  const hor = Horizon(time, observer, eq.ra, eq.dec, "normal");
  return {
    raHours: eq.ra,
    decDeg: eq.dec,
    alt: hor.altitude,
    az: hor.azimuth,
  };
}

export const SKY_BODIES: Array<{
  id:
    | "sun"
    | "moon"
    | "mercury"
    | "venus"
    | "mars"
    | "jupiter"
    | "saturn"
    | "uranus"
    | "neptune"
    | "pluto";
  body: Body;
  name: string;
  magnitude: number;
  color: string;
}> = [
  { id: "sun", body: Body.Sun, name: "Sun", magnitude: -26.7, color: "#fff8e8" },
  { id: "moon", body: Body.Moon, name: "Moon", magnitude: -12.6, color: "#e8eef8" },
  { id: "mercury", body: Body.Mercury, name: "Mercury", magnitude: -0.4, color: "#c8c4b8" },
  { id: "venus", body: Body.Venus, name: "Venus", magnitude: -4.2, color: "#e8d5a0" },
  { id: "mars", body: Body.Mars, name: "Mars", magnitude: 0.5, color: "#e07050" },
  { id: "jupiter", body: Body.Jupiter, name: "Jupiter", magnitude: -2.0, color: "#d4c4a8" },
  { id: "saturn", body: Body.Saturn, name: "Saturn", magnitude: 0.8, color: "#c9b896" },
  { id: "uranus", body: Body.Uranus, name: "Uranus", magnitude: 5.7, color: "#9ec8d8" },
  { id: "neptune", body: Body.Neptune, name: "Neptune", magnitude: 7.8, color: "#6a9fd8" },
  { id: "pluto", body: Body.Pluto, name: "Pluto", magnitude: 14.5, color: "#b0a898" },
];
