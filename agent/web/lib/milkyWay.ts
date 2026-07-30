/**
 * Milky Way — galactic-plane samples in J2000 equatorial coords.
 * Painted as a diffuse noise-textured glow (not hard polylines).
 *
 * Transform: galactic (l, b) → equatorial using the standard J2000 pole
 * (RA₀ = 192.85948°, Dec₀ = 27.12825°, l₀ at NGP = 122.93192°).
 */

export type SkyPoint = { ra: number; dec: number }; // ra hours, dec degrees

/** Soft cloud mote along the galactic plane — irregular size / opacity. */
export type MilkyWayCloudPoint = SkyPoint & { size: number; opacity: number };

const DEG = Math.PI / 180;
const RA_NGP = 192.85948 * DEG;
const DEC_NGP = 27.12825 * DEG;
const L_NGP = 122.93192 * DEG;

/** Deterministic 0..1 hash for irregular cloud texture. */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

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
 * Returns three polylines: center, +b, −b. Kept for coordinate tests / tooling.
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

/**
 * Irregular cloud motes along the galactic plane — no parallel edges.
 * Multiple latitude offsets per longitude with hashed size/opacity.
 */
export function sampleMilkyWayCloud(stepDeg = 3.5): MilkyWayCloudPoint[] {
  const pts: MilkyWayCloudPoint[] = [];
  let i = 0;
  for (let l = 0; l < 360; l += stepDeg) {
    const layers = 4;
    for (let k = 0; k < layers; k++) {
      const b = (hash01(i + 17) - 0.5) * (6 + k * 4);
      const lJitter = (hash01(i + 29) - 0.5) * 2.2;
      const p = galacticToEquatorial(l + lJitter, b);
      pts.push({
        ra: p.ra,
        dec: p.dec,
        size: 22 + hash01(i + 41) * 78 + k * 8,
        opacity: 0.028 + hash01(i + 53) * 0.075,
      });
      i++;
    }
  }
  return pts;
}

/** Cached default band — regenerated once. */
let cached: ReturnType<typeof sampleMilkyWayBand> | null = null;
export function milkyWayBand(): ReturnType<typeof sampleMilkyWayBand> {
  if (!cached) cached = sampleMilkyWayBand();
  return cached;
}

let cachedCloud: MilkyWayCloudPoint[] | null = null;
export function milkyWayCloud(): MilkyWayCloudPoint[] {
  if (!cachedCloud) cachedCloud = sampleMilkyWayCloud();
  return cachedCloud;
}
