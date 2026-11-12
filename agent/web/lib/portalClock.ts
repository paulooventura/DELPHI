/**
 * The temple's time sound on the portal pages (Agon, Mouseion, Adyton): the same second ticks, minute and hour
 * bells and Heliodrome NOW-Chord the React chambers play (Paulo 11-11: "a sonic reference of time all the time").
 * scripts/build-sat-worker.mjs bundles this (via lib/portalBundle.ts) to public/pm-portal.js; portal.html loads it and falls back to
 * the older pm-clock-bed.js only if this file fails to load, so one bed plays, never two.
 * Same gates as the app: Allow access in this tab, and the "delphi-clock-sfx" switch.
 */
import {
  getClockAudio,
  isClockAudioSilenced,
  isClockTimeFrozen,
  parkClockAudio,
  playHourBell,
  playMinuteBell,
  playSecondTick,
  unmuteClockAudio,
  unparkClockAudio,
} from "./clockSfx";
import { isHeliodromeChordWanted, startHeliodromeChord, stopHeliodromeChord, tickHeliodromeChord } from "./heliodromeChord";
import { audibleHeliodromeLanes } from "./heliodromeLaneVoice";
import { computeOrreryState } from "./lore/orreryLanes";
import { HOME_LAT, HOME_LON } from "./observerHome";
import { hasAccessThisSession } from "./deviceAccess";
import { AUDIO_BUS } from "./audioBus";

const SFX_KEY = "delphi-clock-sfx";

function soundOff(): boolean {
  try {
    return localStorage.getItem(SFX_KEY) === "0";
  } catch {
    return true;
  }
}

/** The portal has no live location; the chord's sunrise-based lanes use Delphi's home place. */
function observer(): { lat: number; lon: number } {
  return { lat: HOME_LAT, lon: HOME_LON };
}

let armed = false;
let lastSec = -1;
let lastChime = "";

function wake(): void {
  if (soundOff() || !hasAccessThisSession() || document.visibilityState === "hidden") return;
  const ctx = getClockAudio();
  if (!ctx) return;
  const go = () => {
    if (ctx.state !== "running") return;
    const d = new Date();
    lastSec = d.getSeconds();
    lastChime = `${d.getHours()}:${d.getMinutes()}`;
    unparkClockAudio();
    unmuteClockAudio();
    void startHeliodromeChord();
    armed = true;
  };
  if (ctx.state === "suspended") void ctx.resume().then(go).catch(() => {});
  else go();
}

function park(): void {
  armed = false;
  parkClockAudio({ fadeMs: AUDIO_BUS.LEAVE_MS });
}

function frame(): void {
  const ctx = getClockAudio();
  if (armed && ctx?.state === "running" && document.visibilityState !== "hidden" && !soundOff()) {
    const now = new Date();
    if (isHeliodromeChordWanted()) {
      const { lat, lon } = observer();
      tickHeliodromeChord(audibleHeliodromeLanes(computeOrreryState(now, lat, lon).lanes), true);
    }
    if (!isClockAudioSilenced() && !isClockTimeFrozen()) {
      const sec = now.getSeconds();
      if (sec !== lastSec) {
        lastSec = sec;
        playSecondTick(ctx, sec);
        if (sec === 0) {
          const key = `${now.getHours()}:${now.getMinutes()}`;
          if (key !== lastChime) {
            lastChime = key;
            if (now.getMinutes() === 0) playHourBell(ctx, now.getHours());
            else playMinuteBell(ctx);
          }
        }
      }
    }
  }
  requestAnimationFrame(frame);
}

function onGesture(): void {
  wake();
  if (getClockAudio()?.state === "running") {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
  }
}

declare global {
  interface Window {
    pmClockSoundOn?: () => boolean;
    pmClockSound?: (on: boolean) => void;
    pmClockChord?: boolean;
  }
}

if (typeof window !== "undefined" && !window.pmClockChord) {
  window.pmClockChord = true;
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") park();
    else wake();
  });
  window.addEventListener("pagehide", park);
  window.addEventListener("storage", e => {
    if (e.key !== SFX_KEY) return;
    if (soundOff()) {
      stopHeliodromeChord();
      park();
    } else wake();
  });
  window.pmClockSoundOn = () => !soundOff();
  window.pmClockSound = (on: boolean) => {
    try {
      localStorage.setItem(SFX_KEY, on ? "1" : "0");
    } catch {
      /* private mode */
    }
    if (on) wake();
    else {
      stopHeliodromeChord();
      park();
    }
  };
  wake();
  requestAnimationFrame(frame);
}
