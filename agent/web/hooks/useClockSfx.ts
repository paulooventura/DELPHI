"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  getClockAudio,
  playHourBell,
  playMinuteBell,
  playMsTick,
  playSecondTick,
  resumeClockAudio,
} from "../lib/clockSfx";

function syncChimeRefs(refs: {
  lastMs: MutableRefObject<number>;
  lastSec: MutableRefObject<number>;
  lastChimeKey: MutableRefObject<string>;
}) {
  const d = new Date();
  refs.lastMs.current = d.getMilliseconds();
  refs.lastSec.current = d.getSeconds();
  refs.lastChimeKey.current = `${d.getHours()}:${d.getMinutes()}`;
}

export function useClockSfx(enabled: boolean) {
  const [active, setActive] = useState(false);
  const lastMs = useRef(-1);
  const lastSec = useRef(-1);
  const lastChimeKey = useRef("");

  useEffect(() => {
    if (!enabled) return;

    const refs = { lastMs, lastSec, lastChimeKey };

    const unlock = () => {
      void resumeClockAudio().then(ctx => {
        if (!ctx) return;
        syncChimeRefs(refs);
        setActive(true);
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

        // One chime per minute, on the second hand hitting 12
        if (sec === 0) {
          const chimeKey = `${hr}:${min}`;
          if (chimeKey !== lastChimeKey.current) {
            lastChimeKey.current = chimeKey;
            if (min === 0) {
              playHourBell(ctx, hr);
            } else {
              playMinuteBell(ctx);
            }
          }
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
    enable: () =>
      void resumeClockAudio().then(ctx => {
        if (!ctx) return;
        syncChimeRefs({ lastMs, lastSec, lastChimeKey });
        setActive(true);
      }),
  };
}
