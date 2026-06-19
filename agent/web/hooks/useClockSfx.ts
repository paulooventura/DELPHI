"use client";

import { useEffect, useRef, useState } from "react";
import {
  getClockAudio,
  playHourBell,
  playMinuteBell,
  playMsTick,
  playSecondTick,
  resumeClockAudio,
} from "../lib/clockSfx";

export function useClockSfx(enabled: boolean) {
  const [active, setActive] = useState(false);
  const lastMs = useRef(-1);
  const lastSec = useRef(-1);
  const lastMin = useRef(-1);
  const lastHour = useRef(-1);

  useEffect(() => {
    if (!enabled) return;

    const unlock = () => {
      void resumeClockAudio().then(ctx => {
        if (ctx) setActive(true);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const id = window.setInterval(() => {
      const ctx = getClockAudio();
      if (!ctx || ctx.state !== "running") return;

      const d = new Date();
      const ms = d.getMilliseconds();
      const sec = d.getSeconds();
      const min = d.getMinutes();
      const hr = d.getHours();

      if (ms !== lastMs.current) {
        playMsTick(ctx);
        lastMs.current = ms;
      }
      if (sec !== lastSec.current) {
        playSecondTick(ctx, sec);
        lastSec.current = sec;
      }

      // Bells fire once at the top of each minute
      if (sec === 0 && ms < 20) {
        if (hr !== lastHour.current) {
          playHourBell(ctx, hr);
          lastHour.current = hr;
          lastMin.current = min;
        } else if (min !== lastMin.current) {
          playMinuteBell(ctx);
          lastMin.current = min;
        }
      }
    }, 1);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.clearInterval(id);
    };
  }, [enabled]);

  return {
    active,
    enable: () => void resumeClockAudio().then(ctx => ctx && setActive(true)),
  };
}
