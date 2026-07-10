"use client";

import { useEffect, useRef, useState } from "react";
import { stepSpring } from "../lib/motion/spring";
import { normalizeHeading } from "../lib/sensorSmoothing";

/** Spring-smoothed compass heading — RAF loop for fluid rose animation. */
export function useSmoothHeading(targetDeg: number, enabled = true): number {
  const targetRef = useRef(targetDeg);
  targetRef.current = targetDeg;
  const stateRef = useRef({ value: targetDeg, velocity: 0 });
  const [display, setDisplay] = useState(targetDeg);

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { value: targetDeg, velocity: 0 };
      setDisplay(targetDeg);
      return;
    }

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const prev = stateRef.current.value;
      const target = targetRef.current;
      const delta = ((target - prev + 540) % 360) - 180;
      const wrappedTarget = prev + delta;
      const next = stepSpring(prev, stateRef.current.velocity, wrappedTarget, dt, {
        stiffness: 92,
        damping: 22,
      });
      stateRef.current = next;
      setDisplay(normalizeHeading(next.value));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, targetDeg]);

  return enabled ? display : targetDeg;
}
