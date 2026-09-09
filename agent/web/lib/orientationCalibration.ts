/**
 * True-north correction for the device look ray.
 *
 * The pointing ray comes from the full attitude matrix (see deviceAttitude.ts).
 * North is then applied as a single rotation about world up: raw azimuth plus a
 * yaw offset. That keeps the correction rigid and continuous at every attitude,
 * including the β ≈ 90° gimbal lock at the horizon, where injecting a corrected
 * α back into the matrix used to swing the sky sideways.
 */

import { cameraAzimuthAltitude } from "./deviceAttitude";
import type { Vec3 } from "./sphericalView";

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Session key. Renamed from the α-space value so stale locks cannot leak in. */
const YAW_OFFSET_KEY = "cp-compass-yaw-offset";

/** Magnetic yaw lock: webkit heading − raw camera azimuth, learned while upright. */
let compassYawOffset: number | null = null;
/** Last β used while refreshing the lock — skips updates during pitch sweeps. */
let yawOffsetLastBeta: number | null = null;
/** Whether iOS webkit heading has been seen (needs a portrait lock). */
let webkitSeen = false;
/** East-positive magnetic declination for magnetic compass paths. */
let magneticDeclinationDeg = 0;
/** User fine-tune after sun / landmark / star lock (degrees, east positive). */
let userAzimuthOffsetDeg = 0;
/** Constant pitch bias from “this is where I see it” lock (degrees). */
let userAltitudeOffsetDeg = 0;

function persistYawOffset(): void {
  if (compassYawOffset == null) return;
  try {
    sessionStorage.setItem(YAW_OFFSET_KEY, String(compassYawOffset));
  } catch {
    /* ignore */
  }
}

/** Restore the yaw lock from this session — avoids re-pointing after a tab switch. */
export function restoreOrientationCalibration(): void {
  try {
    const raw = sessionStorage.getItem(YAW_OFFSET_KEY);
    if (raw == null) return;
    const v = Number(raw);
    if (Number.isFinite(v)) compassYawOffset = v;
  } catch {
    /* ignore */
  }
}

export function resetOrientationCalibration(): void {
  compassYawOffset = null;
  yawOffsetLastBeta = null;
  webkitSeen = false;
  try {
    sessionStorage.removeItem(YAW_OFFSET_KEY);
  } catch {
    /* ignore */
  }
}

export function compassNeedsPortraitLock(): boolean {
  return webkitSeen && compassYawOffset == null;
}

export type CompassReadyState = "ready" | "needs-portrait" | "no-sensor";

/** Whether true-north compass is trustworthy enough for AR sky lock. */
export function compassReadyState(event?: CompassEvent | null): CompassReadyState {
  if (typeof window === "undefined") return "no-sensor";
  const hasWebkit = "DeviceOrientationEvent" in window;
  if (!hasWebkit) return "no-sensor";
  if (event?.webkitCompassHeading != null) {
    return compassYawOffset != null ? "ready" : "needs-portrait";
  }
  return "ready";
}

export function setMagneticDeclinationDeg(deg: number): void {
  if (!Number.isFinite(deg)) return;
  magneticDeclinationDeg = deg;
}

export function getMagneticDeclinationDeg(): number {
  return magneticDeclinationDeg;
}

/** Fold any degree value into (−180, 180] — full-circle sun/moon align, not ±20°. */
export function shortestOffsetDeg(deg: number): number {
  return ((deg + 540) % 360) - 180;
}

export function setUserAzimuthOffsetDeg(deg: number): void {
  if (!Number.isFinite(deg)) return;
  userAzimuthOffsetDeg = shortestOffsetDeg(deg);
}

export function getUserAzimuthOffsetDeg(): number {
  return userAzimuthOffsetDeg;
}

export function setUserAltitudeOffsetDeg(deg: number): void {
  if (!Number.isFinite(deg)) return;
  userAltitudeOffsetDeg = clamp(deg, -45, 45);
}

export function getUserAltitudeOffsetDeg(): number {
  return userAltitudeOffsetDeg;
}

/**
 * Offsets that put a known object on the current look ray.
 * `viewAz` / `viewAlt` must already include the current user offsets
 * (the live AR look), matching sun / moon Align.
 */
export function lockLookOffsets(opts: {
  objectAz: number;
  objectAlt: number;
  viewAz: number;
  viewAlt: number;
  currentAzOffset: number;
  currentAltOffset: number;
}): { azOffset: number; altOffset: number } {
  const dAz = shortestOffsetDeg(opts.objectAz - opts.viewAz);
  const dAlt = opts.objectAlt - opts.viewAlt;
  return {
    azOffset: shortestOffsetDeg(opts.currentAzOffset + dAz),
    altOffset: clamp(opts.currentAltOffset + dAlt, -45, 45),
  };
}

/** Magnetic yaw lock in azimuth space, or null until the portrait lock happens. */
export function getCompassYawOffsetDeg(): number | null {
  return compassYawOffset;
}

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** True when the magnetometer heading is trustworthy (portrait, roughly upright). */
export function isUprightPortrait(beta: number | null, gamma: number | null): boolean {
  if (beta == null || !Number.isFinite(beta)) return false;
  const g = gamma ?? 0;
  return Math.abs(beta - 90) < 20 && Math.abs(g) < 25;
}

/** Softest shortest-path blend toward a new lock sample (degrees). */
function blendOffsetToward(from: number, to: number, t: number): number {
  return shortestOffsetDeg(from + shortestOffsetDeg(to - from) * t);
}

/**
 * Camera azimuth / altitude straight off the attitude matrix.
 * Yaw origin is arbitrary on relative streams; absolute streams are earth-referenced.
 */
export function rawLookAzAltDeg(event: CompassEvent): { az: number; alt: number } | null {
  const alpha = event.alpha;
  const beta = event.beta;
  if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;
  if (typeof beta !== "number" || !Number.isFinite(beta)) return null;
  const gamma = typeof event.gamma === "number" && Number.isFinite(event.gamma) ? event.gamma : 0;
  return cameraAzimuthAltitude(alpha, beta, gamma);
}

/**
 * Look direction in true-north topocentric terms.
 *
 * iOS webkitCompassHeading is only trustworthy while roughly upright, and it
 * drifts as you pitch through the horizon — so it is used to learn a yaw offset
 * while upright and never fed into the live ray afterwards.
 */
export function resolveLookAzAltDeg(event: CompassEvent): { az: number; alt: number } | null {
  const raw = rawLookAzAltDeg(event);
  if (raw == null) return null;

  const beta = typeof event.beta === "number" && Number.isFinite(event.beta) ? event.beta : null;
  const gamma = typeof event.gamma === "number" && Number.isFinite(event.gamma) ? event.gamma : 0;
  const webkit =
    typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)
      ? event.webkitCompassHeading
      : null;
  const alt = clamp(raw.alt + userAltitudeOffsetDeg, -89.5, 89.5);

  if (webkit != null) {
    webkitSeen = true;
    if (beta != null && isUprightPortrait(beta, gamma)) {
      const sample = shortestOffsetDeg(webkit - raw.az);
      if (compassYawOffset == null) {
        compassYawOffset = sample;
        persistYawOffset();
      } else {
        // Skip refresh while pitching — horizon sweeps fire β ≈ 90 with lying
        // webkit samples and used to yank the sky sideways.
        const pitchSteady =
          yawOffsetLastBeta != null && Math.abs(beta - yawOffsetLastBeta) < 1.25;
        if (pitchSteady && Math.abs(gamma) < 20) {
          compassYawOffset = blendOffsetToward(compassYawOffset, sample, 0.06);
          persistYawOffset();
        }
      }
      yawOffsetLastBeta = beta;
    } else if (beta != null) {
      yawOffsetLastBeta = beta;
    }

    if (compassYawOffset == null) {
      // Before the portrait lock there is no north claim — track raw yaw only.
      return { az: normalizeHeading(raw.az + userAzimuthOffsetDeg), alt };
    }
    return {
      az: normalizeHeading(
        raw.az + compassYawOffset + magneticDeclinationDeg + userAzimuthOffsetDeg,
      ),
      alt,
    };
  }

  // Absolute streams already carry the earth frame in α, but are still magnetic.
  return {
    az: normalizeHeading(raw.az + magneticDeclinationDeg + userAzimuthOffsetDeg),
    alt,
  };
}

export function resolveCompassHeadingDeg(event: CompassEvent): number | null {
  return resolveLookAzAltDeg(event)?.az ?? null;
}

/** Camera elevation from the full attitude — exact at any roll. */
export function resolveDevicePitchDeg(event: CompassEvent): number | null {
  const raw = rawLookAzAltDeg(event);
  if (raw != null) return clamp(raw.alt, -89.5, 89.5);
  const beta = event.beta;
  if (beta == null || !Number.isFinite(beta)) return null;
  return clamp(beta - 90, -89.5, 89.5);
}

/** @deprecated Elevation now comes from the same resolved ray. */
export function resolveStablePitchDeg(event: CompassEvent): number | null {
  return resolveDevicePitchDeg(event);
}

/** Topocentric look direction: true-north az + camera altitude. */
export function resolveStableLookAzAlt(event: CompassEvent): { az: number; alt: number } | null {
  return resolveLookAzAltDeg(event);
}

export function deviceOrientationToStableViewEnu(event: CompassEvent): Vec3 | null {
  const look = resolveLookAzAltDeg(event);
  if (look == null) return null;
  const DEG = Math.PI / 180;
  const az = look.az * DEG;
  const alt = look.alt * DEG;
  const c = Math.cos(alt);
  return [c * Math.sin(az), c * Math.cos(az), Math.sin(alt)];
}

/**
 * @deprecated North is applied to the resolved ray, not by rebuilding α.
 * Kept so older call sites still compile; α no longer round-trips the matrix.
 */
export function resolveDeviceAlphaDeg(event: CompassEvent): number | null {
  const heading = resolveCompassHeadingDeg(event);
  if (heading == null) return null;
  return normalizeHeading(360 - heading);
}

/** @deprecated Use resolveDeviceAlphaDeg */
export function resolveMatrixAlphaDeg(event: CompassEvent): number | null {
  return resolveDeviceAlphaDeg(event);
}

export type SkyPoseHint = "ready" | "too-flat" | "too-flat-down";

/**
 * Portrait sky AR — camera should have room to tilt without extreme roll.
 * (Flat-on-table is valid: camera points at nadir.)
 */
export function describeSkyPose(beta: number | null, _gamma: number | null): SkyPoseHint {
  if (beta == null || !Number.isFinite(beta)) return "too-flat";
  return "ready";
}

export function skyPoseHintMessage(hint: SkyPoseHint): string {
  switch (hint) {
    case "ready":
      return "";
    case "too-flat":
      return "Motion sensors unavailable — hold the phone steady in portrait.";
    case "too-flat-down":
      return "Roll angle too extreme — keep the phone closer to portrait.";
  }
}
