/**
 * Stars drift on their own (proper motion), slowly reshaping the constellations: Arcturus moves
 * about 8° in 13,000 years, and the Big Dipper's handle bends over 100,000. The Aether sky uses
 * this when the temple's clock is held far from today (Paulo, Nov 10).
 *
 * Linear in RA/Dec from J2000 with the Hipparcos rates (lib/starMotion.ts); precession (the
 * slow wobble of Earth's axis) is applied after this, by astronomy-engine in skyPositions.ts.
 * Good to a fraction of a degree over tens of thousands of years for these bright stars; the
 * stars' true space motion curves the paths slightly over longer spans.
 */
import { BRIGHT_STARS } from "../brightStars";
import { STAR_MOTION } from "../starMotion";

const J2000_MS = Date.UTC(2000, 0, 1, 12);
const YEAR_MS = 365.25 * 86_400_000;
const D2R = Math.PI / 180;
/** Below this many years from J2000 the drift is under ~0.1° for every star: skip the work. */
const NEGLIGIBLE_YEARS = 150;

export function yearsFromJ2000(date: Date): number {
  return (date.getTime() - J2000_MS) / YEAR_MS;
}

/** A star's J2000 RA (hours) / Dec (degrees) moved `years` along its proper motion. */
export function driftRaDec(id: string, raH: number, decDeg: number, years: number): { ra: number; dec: number } {
  const m = STAR_MOTION[id];
  if (!m || Math.abs(years) < NEGLIGIBLE_YEARS) return { ra: raH, dec: decDeg };
  let dec = decDeg + (m[2] * years) / 3.6e6;
  const cosDec = Math.max(0.02, Math.cos(((decDeg + dec) / 2) * D2R));
  let ra = raH + (m[1] * years) / 3.6e6 / cosDec / 15;
  if (dec > 90) {
    dec = 180 - dec;
    ra += 12;
  } else if (dec < -90) {
    dec = -180 - dec;
    ra += 12;
  }
  ra = ((ra % 24) + 24) % 24;
  return { ra, dec };
}

function sepDeg(ra1: number, d1: number, ra2: number, d2: number): number {
  const c = Math.sin(d1 * D2R) * Math.sin(d2 * D2R) + Math.cos(d1 * D2R) * Math.cos(d2 * D2R) * Math.cos((ra1 - ra2) * 15 * D2R);
  return Math.acos(Math.min(1, Math.max(-1, c))) / D2R;
}

/** Constellation line ends are rounded positions: tie each to the bright star it marks, if any. */
const figureStar = new Map<string, string | null>();
function starNear(ra: number, dec: number): string | null {
  const key = `${ra},${dec}`;
  const hit = figureStar.get(key);
  if (hit !== undefined) return hit;
  let best: string | null = null;
  let bestD = 1.2;
  for (const s of BRIGHT_STARS) {
    const d = sepDeg(ra, dec, s.ra, s.dec);
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  figureStar.set(key, best);
  return best;
}

/**
 * A constellation line end moved with the star it marks: the star's drift is added to the
 * line's own rounded point, so the figure keeps its drawn shape near today.
 */
export function driftFigurePoint(raH: number, decDeg: number, years: number): { ra: number; dec: number } {
  if (Math.abs(years) < NEGLIGIBLE_YEARS) return { ra: raH, dec: decDeg };
  const id = starNear(raH, decDeg);
  if (!id) return { ra: raH, dec: decDeg };
  const s = BRIGHT_STARS.find(b => b.id === id)!;
  const moved = driftRaDec(id, s.ra, s.dec, years);
  let dRa = moved.ra - s.ra;
  if (dRa > 12) dRa -= 24;
  else if (dRa < -12) dRa += 24;
  const dec = Math.max(-90, Math.min(90, decDeg + (moved.dec - s.dec)));
  return { ra: (((raH + dRa) % 24) + 24) % 24, dec };
}

/** True when the sky is shown far enough from today that drift and precession matter to the eye. */
export function isDeepSky(date: Date): boolean {
  return Math.abs(yearsFromJ2000(date) - 26) > 1000;
}
