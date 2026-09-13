"use client";

/**
 * Pneuma Mundi symphony bed — Omphalos Runway soundtrack.
 * Mounted above chamber routes so it keeps playing everywhere and layers with
 * the Heliodrome NOW-Chord (Web Audio). Visual plate stays on OnyxHomeFilm (muted).
 *
 * Source: public/pneuma-home-bg.mp4 — encoded with end→start video/audio crossfade
 * so HTML5 loop joins without a click or flash.
 */

import { useEffect, useRef, useState } from "react";
import {
  isSymphonyDucked,
  subscribeSymphonyDuck,
} from "../../lib/symphonyDuck";
import { DELPHI_BUILD } from "../../lib/buildStamp";

export const PNEUMA_SYMPHONY_SRC = "/pneuma-home-bg.mp4";

/** Soft under the chord / ticks — film is the pad, not the lead. */
const SYMPHONY_VOLUME = 0.55;
/** Under Aulos of Delphi so the hymn leads. */
const SYMPHONY_DUCKED = 0.08;

export function OnyxSymphonyBed({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ducked, setDucked] = useState(isSymphonyDucked);

  useEffect(() => subscribeSymphonyDuck(setDucked), []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";

    const ensureLoop = () => {
      // Belt-and-suspenders near the seam (file is already crossfaded).
      if (!v.duration || !Number.isFinite(v.duration)) return;
      if (v.currentTime >= v.duration - 0.04) {
        v.currentTime = 0.02;
        void v.play().catch(() => {});
      }
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        v.pause();
      } else if (enabled) {
        v.muted = false;
        v.volume = isSymphonyDucked() ? SYMPHONY_DUCKED : SYMPHONY_VOLUME;
        void v.play().catch(() => {});
      }
    };

    v.addEventListener("timeupdate", ensureLoop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      v.removeEventListener("timeupdate", ensureLoop);
      document.removeEventListener("visibilitychange", onVis);
      v.pause();
    };
  }, [enabled]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!enabled) {
      v.muted = true;
      v.volume = 0;
      v.pause();
      return;
    }
    v.muted = false;
    v.volume = ducked ? SYMPHONY_DUCKED : SYMPHONY_VOLUME;
    void v.play().catch(() => {});
  }, [enabled, ducked]);

  return (
    <video
      ref={ref}
      className="onyx-symphony-bed"
      src={`${PNEUMA_SYMPHONY_SRC}?v=${DELPHI_BUILD}`}
      loop
      playsInline
      preload="auto"
      aria-hidden
    />
  );
}
