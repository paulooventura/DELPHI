/**
 * Escapement spring — underdamped snap when a discrete-tick lane advances.
 * Settles onto the next integer index (hold position), not onto cell-center.
 * Fast lanes: high stiffness. Slow lanes: heavy flywheel. ~3–6% overshoot.
 */

export type LaneSpring = {
  /** Displayed cell index on an unwrapped continuum. */
  pos: number;
  vel: number;
  /** Unwrapped target index to settle on. */
  target: number;
  /** Last discrete (wrapped) index from the ephemeris. */
  lastIndex: number;
  /** True once locked after a settle — fires one escapement tick. */
  settled: boolean;
  n: number;
};

export function createLaneSpring(index: number, n: number): LaneSpring {
  const i = ((index % n) + n) % n;
  return {
    pos: i,
    vel: 0,
    target: i,
    lastIndex: i,
    settled: true,
    n: Math.max(1, n),
  };
}

/** Stiffness / damping from lane speedT (0 = fastest/red, 1 = slowest/blue). */
export function springParams(speedT: number): { stiffness: number; damping: number } {
  const t = Math.max(0, Math.min(1, speedT));
  const stiffness = 36 + (1 - t) * (1 - t) * 280;
  const zeta = 0.55 + t * 0.12; // slightly underdamped → ~3–6% overshoot
  const damping = 2 * Math.sqrt(stiffness) * zeta;
  return { stiffness, damping };
}

/** Shortest signed step on a circular lane (59 → 0 is +1, not −59). */
export function wrapDelta(from: number, to: number, n: number): number {
  if (n <= 0) return to - from;
  let d = (((to - from) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/**
 * Retarget when the discrete cell advances. Keeps pos continuous across wraps
 * so the spring travels the short way around the circle.
 */
export function retargetSpring(s: LaneSpring, nextIndex: number, n: number): void {
  s.n = Math.max(1, n);
  const next = ((nextIndex % s.n) + s.n) % s.n;
  if (next === s.lastIndex) return;
  const step = wrapDelta(s.lastIndex, next, s.n);
  s.target = s.target + step;
  s.lastIndex = next;
  s.settled = false;
}

/** Integrate one spring step. Returns true on the frame it first settles. */
export function stepSpring(s: LaneSpring, speedT: number, dt: number): boolean {
  const { stiffness, damping } = springParams(speedT);
  const clampedDt = Math.min(0.032, Math.max(0.001, dt));
  const x = s.pos - s.target;
  const a = -stiffness * x - damping * s.vel;
  s.vel += a * clampedDt;
  s.pos += s.vel * clampedDt;

  const justSettled =
    !s.settled &&
    Math.abs(s.pos - s.target) < 0.018 &&
    Math.abs(s.vel) < 0.08;
  if (justSettled) {
    s.pos = s.target;
    s.vel = 0;
    s.settled = true;
    return true;
  }
  if (Math.abs(s.pos - s.target) < 0.004 && Math.abs(s.vel) < 0.02) {
    s.pos = s.target;
    s.vel = 0;
    s.settled = true;
  }
  return false;
}
