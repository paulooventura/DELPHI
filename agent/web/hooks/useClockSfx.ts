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
  unmuteClockAudio,
  unparkClockAudio,
} from "../lib/clockSfx";
import {
  isHeliodromeChordActive,
  isHeliodromeChordWanted,
  startHeliodromeChord,
  stopHeliodromeChord,
  tickHeliodromeChord,
} from "../lib/heliodromeChord";
import { audibleHeliodromeLanes } from "../lib/heliodromeLaneVoice";
import { computeOrreryState } from "../lib/lore/orreryLanes";
import { HOME_LAT, HOME_LON } from "../lib/observerHome";
import { AUDIO_BUS } from "../lib/audioBus";
import { hasAccessThisSession } from "../lib/deviceAccess";
import { startOmphalosBed, stopOmphalosBed } from "../lib/omphalosBed";

export type ClockObserver = { lat: number; lon: number };

/** Allow access granted in this tab, or a Chorus embed (no gate there). */
function soundAllowedThisSession(): boolean {
  if (hasAccessThisSession()) return true;
  try {
    return new URLSearchParams(window.location.search).get("embed") === "1";
  } catch {
    return false;
  }
}

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
  /** Opening films playing: no ticks, marks or beds yet; `enable()` still arms on purpose. */
  hold = false,
) {
  const [active, setActive] = useState(false);
  const lastSec = useRef(-1);
  const lastChimeKey = useRef("");
  const lastMarks = useRef<ClockLaneMarks | null>(null);
  const lastMarkMs = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const holdRef = useRef(hold);
  holdRef.current = hold;

  const readObserver = (): ClockObserver =>
    observerRef?.current ?? { lat: HOME_LAT, lon: HOME_LON };

  useEffect(() => {
    if (!enabled) {
      muteClockAudio({ fadeMs: AUDIO_BUS.LEAVE_MS });
      stopHeliodromeChord();
      stopOmphalosBed();
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
      // Heliodrome NOW-Chord + the home film's bed are the continuous app voices — skip Schumann pad.
      void startHeliodromeChord();
      void startOmphalosBed(ctx);
      setActive(true);
    };

    const unlock = (ev: Event) => {
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.(".onyx-stone-track")) return;
      if (document.visibilityState === "hidden") return;
      // Sound starts at Allow access (page.tsx arms it there), never on a stray tap.
      if (!soundAllowedThisSession() || holdRef.current) return;
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
      if (!enabledRef.current || holdRef.current || document.visibilityState === "hidden") return;
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
          parkClockAudio({ fadeMs: AUDIO_BUS.LEAVE_MS });
          setActive(false);
        }, 2000);
        return;
      }
      restore();
    };

    const onPageHide = () => {
      window.clearTimeout(parkTimer);
      parkClockAudio({ fadeMs: AUDIO_BUS.LEAVE_MS });
      setActive(false);
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);

    const existing = getClockAudio();
    if (
      existing &&
      !holdRef.current &&
      document.visibilityState === "visible" &&
      !isClockAudioSilenced() &&
      soundAllowedThisSession()
    ) {
      if (existing.state === "running") armBed(existing);
      else {
        void existing.resume().then(() => {
          if (!alive || !enabledRef.current || existing.state !== "running") return;
          if (document.visibilityState === "hidden") return;
          armBed(existing);
        }).catch(() => {});
      }
    }

    const loop = () => {
      if (!alive) return;
      const obs = readObserver();
      const now = new Date();
      // Full orrery state is costly; compute it at most once per frame, and only when sound uses it.
      let lanes: ReturnType<typeof computeOrreryState>["lanes"] | undefined;
      // Drive NOW-Chord every frame app-wide (freeze / Aulos duck handled inside tick).
      if (
        enabledRef.current &&
        !holdRef.current &&
        document.visibilityState !== "hidden" &&
        isHeliodromeChordWanted() &&
        getClockAudio()?.state === "running"
      ) {
        lanes = computeOrreryState(now, obs.lat, obs.lon).lanes;
        tickHeliodromeChord(audibleHeliodromeLanes(lanes), enabledRef.current);
      }

      if (
        !enabledRef.current ||
        holdRef.current ||
        document.visibilityState === "hidden" ||
        isClockAudioSilenced() ||
        isClockTimeFrozen()
      ) {
        if (isClockTimeFrozen() || holdRef.current) {
          const held = new Date();
          lastSec.current = held.getSeconds();
          lastMarkMs.current = held.getTime();
        }
        raf = requestAnimationFrame(loop);
        return;
      }
      const ctx = getClockAudio();
      if (ctx?.state === "running") {
        const d = now;
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

        if (isHeliodromeChordActive()) {
          // The chord voices the lanes; marks re-baseline (no burst) once it stops.
          lastMarks.current = null;
        } else {
          const next = readClockLaneMarks(d, obs.lat, obs.lon, lastMarkMs.current, lanes);
          const prev = lastMarks.current;
          if (prev && (marksKey(next) !== marksKey(prev) || next.crossedSunrise || next.crossedSunset)) {
            fireLaneMarks(ctx, prev, next);
          }
          lastMarks.current = next;
        }
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
      void startHeliodromeChord();
      void startOmphalosBed(ctx);
      // Heliodrome NOW-Chord + the home film's bed are the continuous app voices — skip Schumann pad.
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
