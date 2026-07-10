"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  getClockAudio,
  playHourBell,
  playMinuteBell,
  playSecondTick,
  resumeClockAudio,
  startSchumannAtmosphere,
  stopSchumannAtmosphere,
} from "../lib/clockSfx";

function syncChimeRefs(refs: {
  lastSec: MutableRefObject<number>;
  lastChimeKey: MutableRefObject<string>;
}) {
  const d = new Date();
  refs.lastSec.current = d.getSeconds();
  refs.lastChimeKey.current = `${d.getHours()}:${d.getMinutes()}`;
}

export function useClockSfx(enabled: boolean) {
  const [active, setActive] = useState(false);
  const lastSec = useRef(-1);
  const lastChimeKey = useRef("");
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      stopSchumannAtmosphere();
      setActive(false);
      return;
    }

    const refs = { lastSec, lastChimeKey };
    let raf = 0;
    let alive = true;

    const unlock = () => {
      void resumeClockAudio().then(ctx => {
        if (!ctx || !alive) return;
        syncChimeRefs(refs);
        startSchumannAtmosphere(ctx);
        setActive(true);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    // Keep audio alive when tab becomes visible again
    const onVis = () => {
      if (document.visibilityState === "visible" && enabledRef.current) {
        void resumeClockAudio().then(ctx => {
          if (!ctx) return;
          startSchumannAtmosphere(ctx);
          setActive(true);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const existing = getClockAudio();
    if (existing && existing.state === "running") {
      syncChimeRefs(refs);
      startSchumannAtmosphere(existing);
      setActive(true);
    }

    const loop = () => {
      if (!alive) return;
      const ctx = getClockAudio();
      if (ctx) {
        if (ctx.state === "suspended") {
          void ctx.resume();
        } else if (ctx.state === "running") {
          const d = new Date();
          const sec = d.getSeconds();
          const min = d.getMinutes();
          const hr = d.getHours();

          if (sec !== lastSec.current) {
            playSecondTick(ctx, sec);
            lastSec.current = sec;

            if (sec === 0) {
              const chimeKey = `${hr}:${min}`;
              if (chimeKey !== lastChimeKey.current) {
                lastChimeKey.current = chimeKey;
                if (min === 0) playHourBell(ctx, hr);
                else playMinuteBell(ctx);
              }
            }
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVis);
      stopSchumannAtmosphere();
    };
  }, [enabled]);

  return {
    active,
    enable: () =>
      void resumeClockAudio().then(ctx => {
        if (!ctx) return;
        syncChimeRefs({ lastSec, lastChimeKey });
        startSchumannAtmosphere(ctx);
        setActive(true);
      }),
  };
}
