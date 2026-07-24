/**
 * Circular math for phase values.
 *
 * Phase lives on a circle. Naive arithmetic across the 0.999 → 0.001 boundary
 * puts means at the wrong end of the circle and makes "clustering" nonsense.
 */

import type { Phase } from "./types";

export function normalizePhase(p: number): Phase {
  const wrapped = p % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

export function phaseToDeg(p: Phase): number {
  return normalizePhase(p) * 360;
}

/** Shortest signed distance from a to b on the circle, in [-0.5, 0.5]. */
export function phaseDelta(a: Phase, b: Phase): number {
  let d = normalizePhase(b) - normalizePhase(a);
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

/** Circular mean. Returns null for an empty set or a fully uniform ring. */
export function circularMean(phases: Phase[]): Phase | null {
  if (phases.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of phases) {
    const a = normalizePhase(p) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) return null;
  return normalizePhase(Math.atan2(sy, sx) / (2 * Math.PI));
}

/**
 * Circular variance → concentration, in [0, 1].
 * 1 = all phases identical. 0 = uniformly spread around the circle.
 *
 * NOTE: this is a property of the CYCLES, not of the person. Present it as an
 * environmental reading. "Coherence is high right now" is fine.
 * "You are in a high-coherence state" is not — that's the trapdoor.
 */
export function phaseConcentration(phases: Phase[]): number {
  if (phases.length === 0) return 0;
  let sx = 0;
  let sy = 0;
  for (const p of phases) {
    const a = normalizePhase(p) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.hypot(sx, sy) / phases.length;
}

/** Best rational approximation p/q of x with q <= maxQ (Stern–Brocot). */
export function nearestSimpleRatio(
  x: number,
  maxQ = 12,
): { p: number; q: number } {
  if (!Number.isFinite(x) || x <= 0) return { p: 1, q: 1 };
  let bestP = 1;
  let bestQ = 1;
  let bestErr = Infinity;
  for (let q = 1; q <= maxQ; q++) {
    const p = Math.round(x * q);
    if (p < 1) continue;
    const err = Math.abs(x - p / q);
    if (err < bestErr) {
      bestErr = err;
      bestP = p;
      bestQ = q;
    }
  }
  return { p: bestP, q: bestQ };
}

/**
 * How close two periods sit to integer resonance, in [0, 1].
 * Venus/Earth synodic sits near 8:13 — that's the pentagram, and it's real.
 */
export function couplingStrength(periodA: number, periodB: number, maxQ = 12): number {
  if (!Number.isFinite(periodA) || !Number.isFinite(periodB)) return 0;
  if (periodA <= 0 || periodB <= 0) return 0;
  const ratio = periodA / periodB;
  const { p, q } = nearestSimpleRatio(ratio, maxQ);
  const target = p / q;
  const relErr = Math.abs(ratio - target) / target;
  // Penalize complex ratios — 8:13 is interesting, 47:59 is noise.
  const complexity = 1 / Math.sqrt(q);
  return Math.max(0, 1 - relErr * 20) * complexity;
}
