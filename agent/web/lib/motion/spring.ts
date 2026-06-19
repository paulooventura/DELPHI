export type SpringConfig = {
  /** Lower = heavier, more luxurious (default 120). */
  stiffness?: number;
  /** Higher = less oscillation (default 24). */
  damping?: number;
  mass?: number;
};

const DEFAULT: Required<SpringConfig> = { stiffness: 120, damping: 24, mass: 1 };

export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  dtSec: number,
  config: SpringConfig = {},
): { value: number; velocity: number } {
  const { stiffness, damping, mass } = { ...DEFAULT, ...config };
  const dt = Math.min(0.064, Math.max(0.001, dtSec));
  const displacement = value - target;
  const force = -stiffness * displacement - damping * velocity;
  const nextV = velocity + (force / mass) * dt;
  const nextX = value + nextV * dt;
  return { value: nextX, velocity: nextV };
}

export function springSettled(value: number, velocity: number, target: number, epsilon = 0.0008): boolean {
  return Math.abs(value - target) < epsilon && Math.abs(velocity) < epsilon;
}
