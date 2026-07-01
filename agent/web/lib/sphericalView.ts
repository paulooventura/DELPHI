/**
 * ENU (east, north, up) unit-sphere math + gnomonic sky projection.
 * Everything stays fixed in the sky from observer lat/lon; the phone is just a window.
 */

export type Vec3 = readonly [number, number, number];

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function normalize([x, y, z]: Vec3): Vec3 {
  const len = Math.hypot(x, y, z);
  if (len < 1e-12) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Horizontal az (0=north, 90=east) + altitude → ENU unit vector. */
export function altAzToEnu(azDeg: number, altDeg: number): Vec3 {
  const az = azDeg * DEG;
  const alt = altDeg * DEG;
  const c = Math.cos(alt);
  return [c * Math.sin(az), c * Math.cos(az), Math.sin(alt)];
}

/** ENU unit vector → az / alt. */
export function enuToAltAz([e, n, u]: Vec3): { az: number; alt: number } {
  const alt = Math.asin(clamp(u, -1, 1)) * RAD;
  let az = Math.atan2(e, n) * RAD;
  if (az < 0) az += 360;
  return { az, alt };
}

export type ViewBasis = {
  view: Vec3;
  right: Vec3;
  up: Vec3;
};

function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const k = normalize(axis);
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const kd = dot(k, v);
  return normalize([
    v[0] * c + (k[1] * v[2] - k[2] * v[1]) * s + k[0] * kd * (1 - c),
    v[1] * c + (k[2] * v[0] - k[0] * v[2]) * s + k[1] * kd * (1 - c),
    v[2] * c + (k[0] * v[1] - k[1] * v[0]) * s + k[2] * kd * (1 - c),
  ]);
}

/** Roll-free screen basis: world-up aligned, no device γ twist. */
export function buildViewBasis(viewEnu: Vec3, rollDeg = 0): ViewBasis {
  const view = normalize(viewEnu);
  const worldUp: Vec3 = [0, 0, 1];
  const worldNorth: Vec3 = [0, 1, 0];

  let east = cross(worldUp, view);
  let eLen = Math.hypot(east[0], east[1], east[2]);
  if (eLen < 1e-4) {
    east = cross(worldNorth, view);
    eLen = Math.hypot(east[0], east[1], east[2]);
    if (eLen < 1e-4) east = [1, 0, 0];
    else east = [east[0] / eLen, east[1] / eLen, east[2] / eLen];
  } else {
    east = [east[0] / eLen, east[1] / eLen, east[2] / eLen];
  }

  let up = normalize(cross(view, east));
  if (view[2] >= 0 ? dot(up, worldUp) < 0 : dot(up, worldUp) > 0) {
    up = [-up[0], -up[1], -up[2]];
    east = [-east[0], -east[1], -east[2]];
  }

  let right = east;
  if (Math.abs(rollDeg) > 1e-6) {
    right = rotateAroundAxis(right, view, rollDeg * DEG);
    up = normalize(cross(view, right));
  }

  return { view, right, up };
}

/** Spherical linear interpolation between unit vectors. */
export function slerpUnit(a: Vec3, b: Vec3, t: number): Vec3 {
  const au = normalize(a);
  const bu = normalize(b);
  const cos = clamp(dot(au, bu), -1, 1);
  if (cos > 0.9995) {
    return normalize([
      au[0] + (bu[0] - au[0]) * t,
      au[1] + (bu[1] - au[1]) * t,
      au[2] + (bu[2] - au[2]) * t,
    ]);
  }
  if (cos < -0.9995) {
    return normalize([au[0] * (1 - t) - bu[0] * t, au[1] * (1 - t) - bu[1] * t, au[2] * (1 - t) - bu[2] * t]);
  }
  const omega = Math.acos(cos);
  const s = Math.sin(omega);
  const w1 = Math.sin((1 - t) * omega) / s;
  const w2 = Math.sin(t * omega) / s;
  return [au[0] * w1 + bu[0] * w2, au[1] * w1 + bu[1] * w2, au[2] * w1 + bu[2] * w2];
}

export type SkyProjector = {
  toXY: (az: number, alt: number) => [number, number];
  inView: (x: number, y: number, w: number, h: number, pad?: number) => boolean;
  basis: ViewBasis;
};

/** Gnomonic projection — smooth pan in every direction. */
export function createSphericalSkyProjector(
  width: number,
  height: number,
  basis: ViewBasis,
  fovAzDeg: number,
  fovAltHalfDeg: number,
): SkyProjector {
  const { view, right, up } = basis;
  const tanHalf = Math.tan(Math.max(5, fovAltHalfDeg) * DEG);
  const focal = (height / 2) / tanHalf;

  function toXY(az: number, alt: number): [number, number] {
    const obj = altAzToEnu(az, alt);
    const cosA = dot(obj, view);
    if (cosA <= 0.02) return [-9999, -9999];

    const relEast = dot(obj, right);
    const relUp = dot(obj, up);
    const x = width / 2 + (relEast / cosA) * focal;
    const y = height / 2 - (relUp / cosA) * focal;
    return [x, y];
  }

  function inView(x: number, y: number, w: number, h: number, pad = 12): boolean {
    return x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;
  }

  return { toXY, inView, basis: { view, right, up } };
}

import { resolveCompassHeadingDeg, resolveDevicePitchDeg } from "./orientationCalibration";
import {
  deviceToEnuRotationMatrix,
  mat3MulVec,
  DEVICE_CAMERA_AXIS,
} from "./deviceAttitude";

export {
  resetOrientationCalibration,
  describeSkyPose,
  skyPoseHintMessage,
  resolveDeviceAlphaDeg,
  resolveDevicePitchDeg,
  resolveCompassHeadingDeg,
  type SkyPoseHint,
} from "./orientationCalibration";

export {
  deviceCameraVectorEnu,
  deviceToEnuRotationMatrix,
  mat3MulVec,
  DEVICE_CAMERA_AXIS,
} from "./deviceAttitude";

/** @deprecated Use deviceCameraVectorEnu — was +Z (screen-back), not camera −Z. */
export function deviceBackVectorEnu(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Vec3 {
  const R = deviceToEnuRotationMatrix(alphaDeg, betaDeg, gammaDeg);
  return normalize(mat3MulVec(R, [0, 0, 1]));
}

/**
 * Sky look direction: true-north heading (α) + forward/back pitch (β) only.
 * Roll (γ) is ignored — diagonal phone tilt must not skew the view.
 */
export function deviceOrientationToViewEnu(
  event: DeviceOrientationEvent & { webkitCompassHeading?: number },
): Vec3 | null {
  const heading = resolveCompassHeadingDeg(event);
  const pitch = resolveDevicePitchDeg(event);
  if (heading == null || pitch == null) return null;
  return altAzToEnu(heading, pitch);
}

/** Level horizon basis — no device roll (gamma) so pan/tilt stay axis-aligned. */
export function deviceOrientationToBasis(
  event: DeviceOrientationEvent & { webkitCompassHeading?: number },
): ViewBasis | null {
  const view = deviceOrientationToViewEnu(event);
  if (!view) return null;
  return buildViewBasis(view, 0);
}

/** Subtle ground tint when looking down — no snap at horizon. */
export function groundBlendFromView(view: Vec3): number {
  const { alt } = enuToAltAz(view);
  return clamp((-alt - 12) / 48, 0, 0.55);
}
