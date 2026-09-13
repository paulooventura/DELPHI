"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { marksKey, readClockLaneMarks, type ClockLaneMarks } from "../lib/clockLaneMarks";
import {
  getClockAudio,
  isClockAudioSilenced,
  isClockTimeFrozen,
  isSchumannAtmosphereRunning,
  muteClockAudio,
  parkClockAudio,
  playBeatMark,
  playDayGate,
  playGhatiMark,
  playHelekMark,
  playHourBell,
  playKeMark,
  playMinuteBell,
  playMuhurtaMark,
  playPalaMark,
  playPlanetaryHourMark,
  playPranaMark,
  playSecondTick,
  playShiMark,
  playSlowSkyMark,
  resumeClockAudio,
  startSchumannAtmosphere,
  unmuteClockAudio,
  unparkClockAudio,
} from "../lib/clockSfx";
import { isHeliodromeChordActive, isHeliodromeChordWanted, startHeliodromeChord } from "../lib/heliodromeChord";
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
  if (next.helek !== prev.helek) playHelekMark(ctx);
  if (next.prana !== prev.prana) playPranaMark(ctx);
  if (next.pala !== prev.pala) playPalaMark(ctx);
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
    let parkTimer = 0;

    const armBed = (ctx: AudioContext) => {
      refs.observer = readObserver();
      syncChimeRefs(refs);
      unparkClockAudio();
      unmuteClockAudio();
      if (isHeliodromeChordWanted()) void startHeliodromeChord();
      else if (!isSchumannAtmosphereRunning()) startSchumannAtmosphere(ctx);
      setActive(true);
    };

    const unlock = (ev: Event) => {
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.(".onyx-stone-track")) return;
      if (document.visibilityState === "hidden") return;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      // Resume in the gesture turn — do not wait on an outer await first.
      const ctx = getClockAudio();
      if (!ctx) return;
      const go = () => {
        if (!alive || !enabledRef.current || document.visibilityState === "hidden") return;
        armBed(ctx);
      };
      if (ctx.state === "suspended") {
        void ctx.resume().then(go).catch(() => {});
      } else {
        go();
      }
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const restore = () => {
      if (!enabledRef.current || document.visibilityState === "hidden") return;
      window.clearTimeout(parkTimer);
      parkTimer = 0;
      void resumeClockAudio().then(ctx => {
        if (!ctx || !alive || !enabledRef.current || document.visibilityState === "hidden") return;
        armBed(ctx);
      });
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        // Debounce — mobile chrome flickers visibility; hard mute was chopping the bed.
        window.clearTimeout(parkTimer);
        parkTimer = window.setTimeout(() => {
          if (document.visibilityState !== "hidden") return;
          parkClockAudio({ fadeMs: 100 });
          setActive(false);
        }, 2000);
        return;
      }
      restore();
    };

    const onPageHide = () => {
      window.clearTimeout(parkTimer);
      parkClockAudio({ fadeMs: 80 });
      setActive(false);
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);

    const existing = getClockAudio();
    if (
      existing &&
      existing.state === "running" &&
      document.visibilityState === "visible" &&
      !isClockAudioSilenced()
    ) {
      armBed(existing);
    }

    const loop = () => {
      if (!alive) return;
      if (
        !enabledRef.current ||
        document.visibilityState === "hidden" ||
        isClockAudioSilenced() ||
        isClockTimeFrozen()
      ) {
        if (isClockTimeFrozen()) {
          const held = new Date();
          lastSec.current = held.getSeconds();
          lastMarkMs.current = held.getTime();
        }
        raf = requestAnimationFrame(loop);
        return;
      }
      const ctx = getClockAudio();
      if (ctx?.state === "running") {
        const d = new Date();
        const sec = d.getSeconds();
        const min = d.getMinutes();
        const hr = d.getHours();

        if (sec !== lastSec.current) {
          // Heliodrome NOW-Chord owns seconds while open (tic-tac string).
          if (!isHeliodromeChordActive()) playSecondTick(ctx, sec);
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

        const obs = readObserver();
        const next = readClockLaneMarks(d, obs.lat, obs.lon, lastMarkMs.current);
        const prev = lastMarks.current;
        if (
          !isHeliodromeChordActive() &&
          prev &&
          (marksKey(next) !== marksKey(prev) || next.crossedSunrise || next.crossedSunset)
        ) {
          fireLaneMarks(ctx, prev, next);
        }
        lastMarks.current = next;
        lastMarkMs.current = d.getTime();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      window.clearTimeout(parkTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      // Do NOT hard-mute here — React Strict Mode remounts would kill the bed
      // right after Allow access. Mute only when enabled flips off (above).
    };
  }, [enabled]);

  const enable = useCallback(() => {
    const ctx = getClockAudio();
    if (!ctx || document.visibilityState === "hidden") return;
    if (!enabledRef.current) return;
    const arm = () => {
      if (!enabledRef.current || document.visibilityState === "hidden") return;
      syncChimeRefs({
        lastSec,
        lastChimeKey,
        lastMarks,
        lastMarkMs,
        observer: readObserver(),
      });
      unparkClockAudio();
      unmuteClockAudio();
      if (isHeliodromeChordWanted()) void startHeliodromeChord();
      else if (!isSchumannAtmosphereRunning()) startSchumannAtmosphere(ctx);
      setActive(true);
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(arm).catch(() => {});
    } else {
      arm();
    }
  }, []);

  return { active, enable };
}
