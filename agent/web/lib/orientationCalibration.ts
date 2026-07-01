function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** iOS: webkitCompassHeading is only valid near portrait-upright; store alpha offset there. */
let iosAlphaOffset: number | null = null;

export function resetOrientationCalibration(): void {
  iosAlphaOffset = null;
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
      return normalizeHeading(webkit);
    }
    if (iosAlphaOffset != null) {
      return normalizeHeading(alpha + iosAlphaOffset);
    }
    // Before calibration: prefer alpha (tracks yaw while tilting) over tilt-corrupted webkit.
    return normalizeHeading(alpha);
  }

  if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;

  const orient = typeof screen !== "undefined" ? screen.orientation?.angle ?? 0 : 0;
  const absolute = event.absolute === true;
  const base = absolute ? alpha : normalizeHeading(360 - alpha);
  return normalizeHeading(base + orient);
}

/** Device alpha for W3C rotation matrix (opposite sense to compass azimuth). */
export function resolveMatrixAlphaDeg(event: CompassEvent): number | null {
  const heading = resolveCompassHeadingDeg(event);
  if (heading == null) return null;
  return normalizeHeading(360 - heading);
}

export type SkyPoseHint = "ready" | "too-flat" | "too-flat-down";

/**
 * Portrait sky AR needs the phone mostly vertical with the screen toward you.
 * When nearly flat (beta ≈ 0–40), the back of the phone points at the sky — not the floor.
 */
export function describeSkyPose(beta: number | null, gamma: number | null): SkyPoseHint {
  if (beta == null || !Number.isFinite(beta)) return "too-flat";
  if (Math.abs(gamma ?? 0) > 42) return "too-flat";
  // Nearly horizontal — back of phone points at the sky (lap / texting pose).
  if (beta < 45) return "too-flat";
  // Screen nearly face-down — AR window convention breaks down.
  if (beta > 175) return "too-flat-down";
  return "ready";
}

export function skyPoseHintMessage(hint: SkyPoseHint): string {
  switch (hint) {
    case "ready":
      return "";
    case "too-flat":
      return "Hold the phone upright — screen toward you, not flat. Tilt the top edge toward the sky.";
    case "too-flat-down":
      return "Phone tilted too far down — raise it toward the horizon, then tilt the top edge toward your target.";
  }
}
