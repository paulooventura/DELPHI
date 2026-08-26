"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  getClockAudio,
  isClockAudioSilenced,
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
      muteClockAudio({ fadeMs: 180 });
      setActive(false);
      return;
    }

    const refs = { lastSec, lastChimeKey };
    let raf = 0;
    let alive = true;

    const unlock = () => {
      if (document.visibilityState === "hidden") return;
      void resumeClockAudio().then(ctx => {
        if (!ctx || !alive || !enabledRef.current || document.visibilityState === "hidden") return;
        syncChimeRefs(refs);
        unmuteClockAudio();
        startSchumannAtmosphere(ctx);
        setActive(true);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const silence = () => {
      // Fade out — hard-cutting the Schumann bed was the close-app noise.
      muteClockAudio({ fadeMs: 160 });
      setActive(false);
    };

    const restore = () => {
      if (!enabledRef.current || document.visibilityState === "hidden") return;
      void resumeClockAudio().then(ctx => {
        if (!ctx || !alive || !enabledRef.current || document.visibilityState === "hidden") return;
        unmuteClockAudio();
        startSchumannAtmosphere(ctx);
        setActive(true);
      });
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        silence();
        return;
      }
      restore();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", silence);
    // iOS Capacitor often fires blur (Control Center, app switcher peek). Mute
    // like haptics — but always restore on focus so silence does not stick.
    window.addEventListener("blur", silence);
    window.addEventListener("focus", restore);

    const existing = getClockAudio();
    if (
      existing &&
      existing.state === "running" &&
      document.visibilityState === "visible" &&
      !isClockAudioSilenced()
    ) {
      syncChimeRefs(refs);
      unmuteClockAudio();
      startSchumannAtmosphere(existing);
      setActive(true);
    }

    const loop = () => {
      if (!alive) return;
      // Never resume / tick while backgrounded — that fought the fade mute.
      if (
        !enabledRef.current ||
        document.visibilityState === "hidden" ||
        isClockAudioSilenced()
      ) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const ctx = getClockAudio();
      if (ctx) {
        if (ctx.state === "suspended") {
          // Don't spam resume() before a user gesture — browser console floods.
          // Unlock / focus / enable() paths call resumeClockAudio explicitly.
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
      window.removeEventListener("blur", silence);
      window.removeEventListener("focus", restore);
      muteClockAudio({ fadeMs: 120 });
    };
  }, [enabled]);

  return {
    active,
    enable: () =>
      void resumeClockAudio().then(ctx => {
        if (!ctx || document.visibilityState === "hidden") return;
        syncChimeRefs({ lastSec, lastChimeKey });
        unmuteClockAudio();
        startSchumannAtmosphere(ctx);
        setActive(true);
      }),
  };
}
