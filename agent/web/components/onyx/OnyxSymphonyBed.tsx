"use client";

/**
 * Pneuma Mundi symphony bed — the Omphalos film soundtrack.
 * Lives above chamber routes so it keeps playing in Heliodrome / Aether / Agon / …
 * and layers with the Heliodrome NOW-Chord (Web Audio), not replaces it.
 *
 * Source: public/pneuma-home-bg.mp4 (swap when Paulo drops the next Runway loop).
 */

import { useEffect, useRef } from "react";

export const PNEUMA_SYMPHONY_SRC = "/pneuma-home-bg.mp4";

/** Soft under the chord / ticks — film is the pad, not the lead. */
const SYMPHONY_VOLUME = 0.55;

export function OnyxSymphonyBed({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.loop = true;
    a.preload = "auto";
    a.setAttribute("playsinline", "true");

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        a.pause();
      } else if (enabled) {
        a.muted = false;
        a.volume = SYMPHONY_VOLUME;
        void a.play().catch(() => {
          /* needs Allow / stone gesture — useClockSfx unlock covers most sessions */
        });
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      a.pause();
    };
  }, [enabled]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (!enabled) {
      a.muted = true;
      a.volume = 0;
      a.pause();
      return;
    }
    a.muted = false;
    a.volume = SYMPHONY_VOLUME;
    void a.play().catch(() => {
      /* gesture pending */
    });
  }, [enabled]);

  return (
    <audio
      ref={ref}
      className="onyx-symphony-bed"
      src={PNEUMA_SYMPHONY_SRC}
      loop
      playsInline
      preload="auto"
      aria-hidden
    />
  );
}
