function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** iOS: webkitCompassHeading is only valid near portrait-upright; store alpha offset there. */
let iosAlphaOffset: number | null = null;
/** East-positive magnetic declination for non-absolute / magnetic compass paths. */
let magneticDeclinationDeg = 0;
/** User fine-tune after sun / landmark alignment (degrees, shortest-path east positive). */
let userAzimuthOffsetDeg = 0;

export function resetOrientationCalibration(): void {
  iosAlphaOffset = null;
}

export function setMagneticDeclinationDeg(deg: number): void {
  if (!Number.isFinite(deg)) return;
  magneticDeclinationDeg = deg;
}

export function getMagneticDeclinationDeg(): number {
  return magneticDeclinationDeg;
}

export function setUserAzimuthOffsetDeg(deg: number): void {
  if (!Number.isFinite(deg)) return;
  userAzimuthOffsetDeg = clamp(deg, -20, 20);
}

export function getUserAzimuthOffsetDeg(): number {
  return userAzimuthOffsetDeg;
}

function finalizeTrueHeading(heading: number, applyDeclination: boolean): number {
  let out = heading;
  if (applyDeclination) {
    out = normalizeHeading(out + magneticDeclinationDeg);
  }
  return normalizeHeading(out + userAzimuthOffsetDeg);
}

export function getIosAlphaOffset(): number | null {
  return iosAlphaOffset;
}

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** True when the magnetometer heading is trustworthy (portrait, roughly upright). */
export function isUprightPortrait(beta: number | null, gamma: number | null): boolean {
  if (beta == null || !Number.isFinite(beta)) return false;
  const g = gamma ?? 0;
  return Math.abs(beta - 90) < 20 && Math.abs(g) < 25;
}

/**
 * Resolve compass azimuth for decoupled pan/tilt sky view.
 * iOS webkitCompassHeading drifts ~180° when the phone is tilted toward the sky — never use it tilted.
 */
export function resolveCompassHeadingDeg(event: CompassEvent): number | null {
  const beta = event.beta;
  const gamma = event.gamma ?? 0;
  const alpha = event.alpha;
  const webkit =
    typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)
      ? event.webkitCompassHeading
      : null;

  if (webkit != null && typeof alpha === "number" && Number.isFinite(alpha)) {
    if (isUprightPortrait(beta, gamma)) {
      iosAlphaOffset = normalizeHeading(webkit - alpha);
      // webkitCompassHeading is magnetic north — convert to true north for ephemeris.
      return finalizeTrueHeading(webkit, true);
    }
    if (iosAlphaOffset != null) {
      return finalizeTrueHeading(normalizeHeading(alpha + iosAlphaOffset), true);
    }
    // Before portrait calibration: alpha-only track (no declination yet).
    return finalizeTrueHeading(normalizeHeading(alpha), false);
  }

  if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;

  const orient = typeof screen !== "undefined" ? screen.orientation?.angle ?? 0 : 0;
  const absolute = event.absolute === true;
  const base = absolute ? alpha : normalizeHeading(360 - alpha);
  const heading = normalizeHeading(base + orient);
  if (!absolute) {
    return finalizeTrueHeading(heading, true);
  }
  return finalizeTrueHeading(heading, false);
}

/**
 * Camera elevation from forward/back tilt (β) only — ignores roll (γ).
 * Portrait upright (β ≈ 90°) → 0°; top toward sky (β < 90) → positive; toward ground → negative.
 */
export function resolveDevicePitchDeg(event: CompassEvent): number | null {
  const beta = event.beta;
  if (beta == null || !Number.isFinite(beta)) return null;
  return clamp(beta - 90, -89.5, 89.5);
}

/** W3C α for Rz(α)·Rx(β)·Ry(γ) — opposite sense to compass azimuth; true north via resolveCompassHeadingDeg. */
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
