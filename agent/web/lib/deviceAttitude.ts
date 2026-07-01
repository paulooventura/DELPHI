/**
 * Device attitude → camera pointing ray in world ENU.
 *
 * Device frame (screen in portrait, looking at display):
 *   +X right, +Y top, +Z toward the user (screen normal).
 * Camera / back axis = (0, 0, -1) — exits through the cameras on the back.
 *
 * Attitude: W3C DeviceOrientation Tait–Bryan Rz(α) · Rx(β) · Ry(γ), referenced to
 * true north via resolveDeviceAlphaDeg() (iOS webkit calibration + absolute α on Android).
 * worldVec = R · deviceVec  →  (east, north, up).
 */

import { clamp, normalize, type Vec3 } from "./sphericalView";

const DEG = Math.PI / 180;

/** Camera axis in device coordinates — back of phone / lens direction. */
export const DEVICE_CAMERA_AXIS: Vec3 = [0, 0, -1];

export type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/** W3C DeviceOrientation rotation: device frame → ENU (east, north, up). */
export function deviceToEnuRotationMatrix(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Mat3 {
  const _x = betaDeg * DEG;
  const _y = gammaDeg * DEG;
  const _z = alphaDeg * DEG;
  const cX = Math.cos(_x);
  const sX = Math.sin(_x);
  const cY = Math.cos(_y);
  const sY = Math.sin(_y);
  const cZ = Math.cos(_z);
  const sZ = Math.sin(_z);

  // R = Rz(α) · Rx(β) · Ry(γ)  — column vectors: v_enu = R · v_device
  return [
    [cZ * cY - sZ * sX * sY, -sZ * cX, cZ * sY + sZ * sX * cY],
    [sZ * cY + cZ * sX * sY, cZ * cX, sZ * sY - cZ * sX * cY],
    [-cX * sY, sX, cX * cY],
  ] as const;
}

export function mat3MulVec(m: Mat3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

/** Damp device roll (γ) when the camera sight line is near the horizon — reduces azimuth twitch. */
export function horizonGammaFactor(betaDeg: number): number {
  const d = Math.abs(betaDeg - 90);
  if (d >= 22) return 1;
  return clamp(d / 22, 0, 1);
}

/** Unit vector in ENU along the camera axis after attitude rotation. */
export function deviceCameraVectorEnu(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Vec3 {
  const g = gammaDeg * horizonGammaFactor(betaDeg);
  const R = deviceToEnuRotationMatrix(alphaDeg, betaDeg, g);
  return normalize(mat3MulVec(R, DEVICE_CAMERA_AXIS));
}

export function cameraAzimuthAltitude(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): { az: number; alt: number } {
  const [east, north, up] = deviceCameraVectorEnu(alphaDeg, betaDeg, gammaDeg);
  const alt = Math.asin(clamp(up, -1, 1)) * (180 / Math.PI);
  let az = Math.atan2(east, north) * (180 / Math.PI);
  if (az < 0) az += 360;
  return { az, alt };
}
