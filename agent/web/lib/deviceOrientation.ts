/**
 * Portrait sky-window orientation: where the phone screen center points in az/alt.
 * iOS: webkitCompassHeading + tilt-compensated bearing, altitude from beta.
 */

type OrientEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function screenAngleDeg(): number {
  if (typeof screen === "undefined") return 0;
  return screen.orientation?.angle ?? 0;
}

function compassHeadingDeg(event: OrientEvent): number | null {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    return normalizeHeading(event.webkitCompassHeading);
  }
  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha)) return null;
  const orient = screenAngleDeg();
  const alpha = event.absolute ? event.alpha : normalizeHeading(360 - event.alpha);
  return normalizeHeading(alpha + orient);
}

/** Tilt-compensated azimuth while the phone is pitched toward the sky. */
function tiltCompensatedAzimuth(headingDeg: number, betaDeg: number, gammaDeg: number): number {
  const hr = headingDeg * (Math.PI / 180);
  const br = betaDeg * (Math.PI / 180);
  const gr = gammaDeg * (Math.PI / 180);
  let az =
    Math.atan2(
      Math.sin(hr) * Math.cos(br) + Math.tan(gr) * Math.sin(br),
      Math.cos(hr) * Math.cos(br),
    ) * (180 / Math.PI);
  if (az < 0) az += 360;
  return normalizeHeading(az);
}

function portraitAltitude(betaDeg: number, gammaDeg: number, orient: number): number {
  let alt: number;
  if (orient === 90 || orient === 270) {
    alt = 90 - Math.abs(gammaDeg);
  } else {
    alt = 90 - betaDeg;
  }
  if (alt > 90) alt = 180 - alt;
  if (alt < -90) alt = -180 - alt;
  return Math.max(-90, Math.min(90, alt));
}

/**
 * Azimuth (° from north) and altitude (° above horizon) for the sky crosshair.
 * Hold the phone portrait, screen toward you, and tilt the top toward the target.
 */
export function deviceViewAltAz(event: DeviceOrientationEvent): { az: number; alt: number } | null {
  const beta = event.beta;
  if (beta == null || !Number.isFinite(beta)) return null;

  const gamma = typeof event.gamma === "number" && Number.isFinite(event.gamma) ? event.gamma : 0;
  const heading = compassHeadingDeg(event as OrientEvent);
  if (heading == null) return null;

  const orient = screenAngleDeg();
  const alt = portraitAltitude(beta, gamma, orient);
  const az = tiltCompensatedAzimuth(heading, beta, gamma);

  return { az, alt };
}

export function deviceHeadingDeg(event: DeviceOrientationEvent): number | null {
  return compassHeadingDeg(event as OrientEvent);
}

export function devicePitchDeg(event: DeviceOrientationEvent): number | null {
  const beta = event.beta;
  if (beta == null || !Number.isFinite(beta)) return null;
  const gamma = typeof event.gamma === "number" && Number.isFinite(event.gamma) ? event.gamma : 0;
  return portraitAltitude(beta, gamma, screenAngleDeg());
}
