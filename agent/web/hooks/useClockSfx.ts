"use client";

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { marksKey, readClockLaneMarks, type ClockLaneMarks } from "../lib/clockLaneMarks";
import {
  getClockAudio,
  isClockAudioSilenced,
  muteClockAudio,
  playBeatMark,
  playDayGate,
  playGhatiMark,
  playHourBell,
  playKeMark,
  playMinuteBell,
  playMuhurtaMark,
  playPlanetaryHourMark,
  playSecondTick,
  playShiMark,
  playSlowSkyMark,
  resumeClockAudio,
  startSchumannAtmosphere,
  unmuteClockAudio,
} from "../lib/clockSfx";
import { HOME_LAT, HOME_LON } from "../lib/observerHome";

export type ClockObserver = { lat: number; lon: number };

function syncChimeRefs(refs: {
  lastSec: MutableRefObject<number>;
  lastChimeKey: MutableRefObject<string>;
  lastMarks: MutableRefObject<ClockLaneMarks | null>;
  lastMarkMs: MutableRefObject<number>;
  observer: ClockObserver;
}) {
  const d = new Date();
  refs.lastSec.current = d.getSeconds();
  refs.lastChimeKey.current = `${d.getHours()}:${d.getMinutes()}`;
  refs.lastMarkMs.current = d.getTime();
  refs.lastMarks.current = readClockLaneMarks(d, refs.observer.lat, refs.observer.lon);
}

function fireLaneMarks(ctx: AudioContext, prev: ClockLaneMarks, next: ClockLaneMarks) {
  if (next.ghati !== prev.ghati) playGhatiMark(ctx);
  if (next.muhurta !== prev.muhurta) playMuhurtaMark(ctx);
  if (next.planetaryHour !== prev.planetaryHour) playPlanetaryHourMark(ctx, next.planetaryHour);
  if (next.shi !== prev.shi) playShiMark(ctx, next.shi);
  if (next.ke !== prev.ke) playKeMark(ctx);
  if (next.beat !== prev.beat) playBeatMark(ctx);
  if (next.crossedSunrise) playDayGate(ctx, "sunrise");
  if (next.crossedSunset) playDayGate(ctx, "sunset");
  if (next.moon !== prev.moon) playSlowSkyMark(ctx, "moon");
  if (next.wuku !== prev.wuku) playSlowSkyMark(ctx, "wuku");
  if (next.pancawara !== prev.pancawara) playSlowSkyMark(ctx, "pancawara");
  if (next.season !== prev.season) playSlowSkyMark(ctx, "season");
}

export function useClockSfx(
  enabled: boolean,
  observerRef?: RefObject<ClockObserver>,
) {
  const [active, setActive] = useState(false);
  const lastSec = useRef(-1);
  const lastChimeKey = useRef("");
  const lastMarks = useRef<ClockLaneMarks | null>(null);
  const lastMarkMs = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const readObserver = (): ClockObserver =>
    observerRef?.current ?? { lat: HOME_LAT, lon: HOME_LON };

  useEffect(() => {
    if (!enabled) {
      muteClockAudio({ fadeMs: 180 });
      setActive(false);
      return;
    }

    const refs = { lastSec, lastChimeKey, lastMarks, lastMarkMs, observer: readObserver() };
    let raf = 0;
    let alive = true;

    const unlock = (ev: Event) => {
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.(".onyx-stone-track")) return;
      if (document.visibilityState === "hidden") return;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void resumeClockAudio().then(ctx => {
        if (!ctx || !alive || !enabledRef.current || document.visibilityState === "hidden") return;
        refs.observer = readObserver();
        syncChimeRefs(refs);
        unmuteClockAudio();
        startSchumannAtmosphere(ctx);
        setActive(true);
      });
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const silence = () => {
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
    window.addEventListener("blur", silence);
    window.addEventListener("focus", restore);

    const existing = getClockAudio();
    if (
      existing &&
      existing.state === "running" &&
      document.visibilityState === "visible" &&
      !isClockAudioSilenced()
    ) {
      refs.observer = readObserver();
      syncChimeRefs(refs);
      unmuteClockAudio();
      startSchumannAtmosphere(existing);
      setActive(true);
    }

    const loop = () => {
      if (!alive) return;
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
        if (ctx.state === "running") {
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

            const obs = readObserver();
            const next = readClockLaneMarks(d, obs.lat, obs.lon, lastMarkMs.current);
            const prev = lastMarks.current;
            if (
              prev &&
              (marksKey(next) !== marksKey(prev) || next.crossedSunrise || next.crossedSunset)
            ) {
              fireLaneMarks(ctx, prev, next);
            }
            lastMarks.current = next;
            lastMarkMs.current = d.getTime();
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
        syncChimeRefs({
          lastSec,
          lastChimeKey,
          lastMarks,
          lastMarkMs,
          observer: readObserver(),
        });
        unmuteClockAudio();
        startSchumannAtmosphere(ctx);
        setActive(true);
      }),
  };
}
