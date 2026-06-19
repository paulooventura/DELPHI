"use client";

import { useEffect, useRef, useState } from "react";
import { getClockAudio, playMsTick, playSecondTick, resumeClockAudio } from "../lib/clockSfx";

export function useClockSfx(enabled: boolean) {
  const [active, setActive] = useState(false);
  const lastMs = useRef(-1);
  const lastSec = useRef(-1);

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

      if (ms !== lastMs.current) {
        playMsTick(ctx);
        lastMs.current = ms;
      }
      if (sec !== lastSec.current) {
        playSecondTick(ctx, sec);
        lastSec.current = sec;
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
