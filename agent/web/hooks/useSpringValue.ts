"use client";

import { useEffect, useRef, useState } from "react";
import { type SpringConfig, springSettled, stepSpring } from "../lib/motion/spring";

const LUXURY: SpringConfig = { stiffness: 110, damping: 26, mass: 1.05 };

/**
 * Damped spring toward `target` — high damping, low stiffness for weighted motion.
 */
export function useSpringValue(target: number, config: SpringConfig = LUXURY): number {
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const targetRef = useRef(target);
  targetRef.current = target;
  const simRef = useRef({ value: target, velocity: 0 });
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const sim = simRef.current;
      const next = stepSpring(sim.value, sim.velocity, targetRef.current, dt, cfgRef.current);
      simRef.current = next;

      if (!springSettled(next.value, next.velocity, targetRef.current)) {
        setDisplay(next.value);
      } else if (next.value !== targetRef.current) {
        simRef.current = { value: targetRef.current, velocity: 0 };
        setDisplay(targetRef.current);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return display;
}
