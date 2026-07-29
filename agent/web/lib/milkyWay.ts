/**
 * Milky Way band — samples of the galactic plane in J2000 equatorial coords.
 * Drawn as a soft glowing ribbon so the user can find the galactic equator.
 *
 * Transform: galactic (l, b) → equatorial using the standard J2000 pole
 * (RA₀ = 192.85948°, Dec₀ = 27.12825°, l₀ at NGP = 122.93192°).
 */

export type SkyPoint = { ra: number; dec: number }; // ra hours, dec degrees

const DEG = Math.PI / 180;
const RA_NGP = 192.85948 * DEG;
const DEC_NGP = 27.12825 * DEG;
const L_NGP = 122.93192 * DEG;

/** Galactic longitude/latitude (degrees) → J2000 RA hours / Dec degrees. */
export function galacticToEquatorial(lDeg: number, bDeg: number): SkyPoint {
  const l = lDeg * DEG;
  const b = bDeg * DEG;
  const sinB = Math.sin(b);
  const cosB = Math.cos(b);
  const sinL = Math.sin(l - L_NGP);
  const cosL = Math.cos(l - L_NGP);

  // IAU J2000: sinδ / cosδ·sin(α−α_G) / cosδ·cos(α−α_G)
  const sinDec = sinB * Math.sin(DEC_NGP) + cosB * Math.cos(DEC_NGP) * cosL;
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  // Note the minus on sin(l−l₀) — without it the galactic center lands at ~8h instead of ~17.8h.
  const y = -cosB * sinL;
  const x = sinB * Math.cos(DEC_NGP) - cosB * Math.sin(DEC_NGP) * cosL;
  let ra = Math.atan2(y, x) + RA_NGP;
  ra = ((ra % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  return { ra: (ra * 180) / Math.PI / 15, dec: (dec * 180) / Math.PI };
}

/**
 * Dense sample of the galactic equator (±widthDeg for a soft band).
 * Returns three polylines: center, +b, −b.
 */
export function sampleMilkyWayBand(
  stepDeg = 4,
  widthDeg = 8,
): { center: SkyPoint[]; north: SkyPoint[]; south: SkyPoint[] } {
  const center: SkyPoint[] = [];
  const north: SkyPoint[] = [];
  const south: SkyPoint[] = [];
  for (let l = 0; l < 360; l += stepDeg) {
    center.push(galacticToEquatorial(l, 0));
    north.push(galacticToEquatorial(l, widthDeg));
    south.push(galacticToEquatorial(l, -widthDeg));
  }
  // Close the loop
  center.push(center[0]!);
  north.push(north[0]!);
  south.push(south[0]!);
  return { center, north, south };
}

/** Cached default band — regenerated once. */
let cached: ReturnType<typeof sampleMilkyWayBand> | null = null;
export function milkyWayBand(): ReturnType<typeof sampleMilkyWayBand> {
  if (!cached) cached = sampleMilkyWayBand();
  return cached;
}
