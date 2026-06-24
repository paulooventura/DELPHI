/**
 * Portrait sky AR: where the phone screen center points (az from north, alt above horizon).
 * iOS: webkitCompassHeading + standard tilt-compensated bearing.
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
  // iOS Safari: true compass — do NOT add screen.orientation.angle
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    return normalizeHeading(event.webkitCompassHeading);
  }
  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha)) return null;
  const orient = screenAngleDeg();
  const alpha = event.absolute ? event.alpha : normalizeHeading(360 - event.alpha);
  return normalizeHeading(alpha + orient);
}

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
  return Math.max(-90, Math.min(90, alt));
}

/** Compass is stabler than tilt-compensated azimuth near the horizon / when phone is flat. */
function viewAzimuthDeg(
  headingDeg: number,
  betaDeg: number,
  gammaDeg: number,
  altDeg: number,
): number {
  const nearHorizon = Math.abs(altDeg) < 22;
  const phoneFlat = Math.abs(betaDeg) > 68;
  if (nearHorizon || phoneFlat) return headingDeg;
  return tiltCompensatedAzimuth(headingDeg, betaDeg, gammaDeg);
}

export function deviceViewAltAz(event: DeviceOrientationEvent): { az: number; alt: number } | null {
  const beta = event.beta;
  if (beta == null || !Number.isFinite(beta)) return null;

  const gamma = typeof event.gamma === "number" && Number.isFinite(event.gamma) ? event.gamma : 0;
  const heading = compassHeadingDeg(event as OrientEvent);
  if (heading == null) return null;

  const orient = screenAngleDeg();
  const alt = portraitAltitude(beta, gamma, orient);
  const az = viewAzimuthDeg(heading, beta, gamma, alt);

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
