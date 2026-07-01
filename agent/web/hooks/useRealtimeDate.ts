"use client";

import { useEffect, useState } from "react";

/**
 * High-frequency wall clock via `requestAnimationFrame` (~60 Hz).
 */
export function useRealtimeDate(enabled = true): Date {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const tick = () => {
      setCurrentDate(new Date());
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  return currentDate;
}
