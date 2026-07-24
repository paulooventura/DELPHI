"use client";

import { useEffect, useRef, useState } from "react";
import { CosmicClockEngine, type CosmicClockInput, type CosmicClockState } from "../lib/cosmic";
import { watchAmbientLux } from "../lib/cosmic/sensors";

export type UseCosmicClockOptions = CosmicClockInput & {
  /** Target ~60 FPS engine tick (default 16 ms). */
  tickMs?: number;
  enabled?: boolean;
  /** Added to wall-clock ms when computing engine baseline. */
  timeOffsetMs?: number;
  /** When set, replaces live clock entirely (time scrub). */
  referenceTime?: Date | null;
};

/**
 * High-precision centralized tick hook.
 * One baseline `now` drives all cycle matrices via {@link CosmicClockEngine}.
 */
export function useCosmicClock(options: UseCosmicClockOptions) {
  const {
    lat,
    lon,
    headingDeg = null,
    altitudeM = null,
    pressureHpa = null,
    lux: luxInput = null,
    tickMs = 16,
    enabled = true,
    timeOffsetMs = 0,
    referenceTime = null,
  } = options;

  const engineRef = useRef<CosmicClockEngine | null>(null);
  const [state, setState] = useState<CosmicClockState | null>(null);

  if (!engineRef.current) {
    engineRef.current = new CosmicClockEngine({ lat, lon, headingDeg, altitudeM, pressureHpa, lux: luxInput });
  }

  useEffect(() => {
    engineRef.current?.setInput({ lat, lon, headingDeg, altitudeM, pressureHpa, lux: luxInput });
  }, [lat, lon, headingDeg, altitudeM, pressureHpa, luxInput]);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let last = 0;

    const loop = (t: number) => {
      if (t - last >= tickMs) {
        last = t;
        const engine = engineRef.current;
        if (engine) {
          const now = referenceTime ?? new Date(Date.now() + timeOffsetMs);
          setState(engine.tick(now));
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [enabled, tickMs, timeOffsetMs, referenceTime]);

  useEffect(() => {
    if (!enabled) return;
    return watchAmbientLux(lux => engineRef.current?.setLux(lux));
  }, [enabled]);

  return {
    state,
    now: state?.now ?? new Date(),
    engine: engineRef.current,
  };
}
