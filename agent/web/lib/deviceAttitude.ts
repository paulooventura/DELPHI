/**
 * Device attitude → camera pointing ray in world ENU.
 *
 * Device frame (screen in portrait, looking at the display):
 *   +X right, +Y top, +Z toward the user (screen normal).
 * Camera / back axis = (0, 0, -1) — exits through the cameras on the back.
 *
 * Attitude is the W3C DeviceOrientation Tait-Bryan product Rz(α)·Rx(β)·Ry(γ),
 * so worldVec = R · deviceVec → (east, north, up).
 *
 * All three angles are used. Near β = ±90° — the phone upright, camera on the
 * horizon — the Z-X'-Y'' parametrisation is gimbal locked: azimuth depends only
 * on α + γ, and the device is free to trade one for the other between frames.
 * Reading yaw from α alone throws away half of it, which is what dragged the
 * sky sideways every time the camera crossed the horizon. The rotation matrix
 * stays continuous through the lock, so the ray is taken from the matrix and
 * true north is applied afterwards as a rotation about world up.
 */

import type { Vec3 } from "./sphericalView";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Camera axis in device coordinates — back of phone / lens direction. */
export const DEVICE_CAMERA_AXIS: Vec3 = [0, 0, -1];

export type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

function clampLocal(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeLocal([x, y, z]: Vec3): Vec3 {
  const len = Math.hypot(x, y, z);
  if (len < 1e-12) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

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

/**
 * Unit look vector in ENU along the camera axis, from the full attitude.
 *
 * Roll about the camera axis leaves this vector fixed on its own, so the sky
 * never spins with the phone; the screen basis is rebuilt roll-free elsewhere.
 */
export function deviceCameraVectorEnu(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Vec3 {
  const R = deviceToEnuRotationMatrix(alphaDeg, betaDeg, gammaDeg);
  return normalizeLocal(mat3MulVec(R, DEVICE_CAMERA_AXIS));
}

export function cameraAzimuthAltitude(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): { az: number; alt: number } {
  const [east, north, up] = deviceCameraVectorEnu(alphaDeg, betaDeg, gammaDeg);
  const alt = Math.asin(clampLocal(up, -1, 1)) * RAD;
  let az = Math.atan2(east, north) * RAD;
  if (az < 0) az += 360;
  return { az, alt };
}
