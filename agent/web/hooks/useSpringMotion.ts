"use client";

import { useRef } from "react";
import type { ClockRingData } from "../lib/timeEngine";
import { ringCycleFraction } from "../lib/timeEngine";
import { stepSpring, type SpringConfig } from "../lib/motion/spring";

type SpringState = { value: number; velocity: number };

function frameDelta(lastRef: React.MutableRefObject<number | null>): number {
  const now = performance.now();
  const dt = lastRef.current == null ? 1 / 60 : Math.min(0.05, (now - lastRef.current) / 1000);
  lastRef.current = now;
  return dt;
}

const RING_SPRING_BY_ID: Record<number, SpringConfig> = {
  0: { stiffness: 380, damping: 36 },
  1: { stiffness: 240, damping: 30 },
  2: { stiffness: 180, damping: 28 },
  3: { stiffness: 140, damping: 26 },
  4: { stiffness: 110, damping: 24 },
  5: { stiffness: 95, damping: 22 },
};

const RING_SPRING_DEFAULT: SpringConfig = { stiffness: 88, damping: 21 };
const PROGRESS_SPRING: SpringConfig = { stiffness: 72, damping: 18 };

/** Smooth ring cycle fractions on each render (pairs with ~60 Hz realtime date). */
export function useRingFractionSprings(rings: ClockRingData[]): Map<number, number> {
  const statesRef = useRef(new Map<number, SpringState>());
  const lastRef = useRef<number | null>(null);
  const dt = frameDelta(lastRef);
  const out = new Map<number, number>();

  for (const ring of rings) {
    const target = ringCycleFraction(ring);
    const prev = statesRef.current.get(ring.ringId) ?? { value: target, velocity: 0 };
    const cfg = RING_SPRING_BY_ID[ring.ringId] ?? RING_SPRING_DEFAULT;
    const next = stepSpring(prev.value, prev.velocity, target, dt, cfg);
    statesRef.current.set(ring.ringId, next);
    out.set(ring.ringId, next.value);
  }

  return out;
}

/** Single scalar spring — progress bars, breath, etc. */
export function useSpringScalar(target: number, config: SpringConfig = PROGRESS_SPRING): number {
  const stateRef = useRef<SpringState>({ value: target, velocity: 0 });
  const lastRef = useRef<number | null>(null);
  const dt = frameDelta(lastRef);
  const next = stepSpring(stateRef.current.value, stateRef.current.velocity, target, dt, config);
  stateRef.current = next;
  return next.value;
}
