"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  getClockAudio,
  muteClockAudio,
  playHourBell,
  playMinuteBell,
  playSecondTick,
  resumeClockAudio,
  startSchumannAtmosphere,
  unmuteClockAudio,
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
      muteClockAudio();
      setActive(false);
      return;
    }

    const refs = { lastSec, lastChimeKey };
    let raf = 0;
    let alive = true;

    const unlock = () => {
      void resumeClockAudio().then(ctx => {
        if (!ctx || !alive || !enabledRef.current) return;
        syncChimeRefs(refs);
        unmuteClockAudio();
        startSchumannAtmosphere(ctx);
        setActive(true);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const silence = () => {
      muteClockAudio();
      setActive(false);
    };

    // Tab/app background or close — cut audio instantly (no close buzz).
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        silence();
        return;
      }
      if (enabledRef.current) {
        void resumeClockAudio().then(ctx => {
          if (!ctx || !enabledRef.current) return;
          unmuteClockAudio();
          startSchumannAtmosphere(ctx);
          setActive(true);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", silence);

    const existing = getClockAudio();
    if (existing && existing.state === "running") {
      syncChimeRefs(refs);
      unmuteClockAudio();
      startSchumannAtmosphere(existing);
      setActive(true);
    }

    const loop = () => {
      if (!alive) return;
      if (!enabledRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
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
      window.removeEventListener("pagehide", silence);
      muteClockAudio();
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
