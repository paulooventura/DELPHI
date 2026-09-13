"use client";

import { useEffect, useRef } from "react";

/**
 * Home street background — Paulo’s Runway Max loop (public/pneuma-home-bg.mp4).
 * Video autoplays muted; soundtrack turns on after Allow access when the stone is on.
 * Pauses when the tab is hidden.
 */
export function OnyxHomeFilm({ soundEnabled = false }: { soundEnabled?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const play = () => {
      void v.play().catch(() => {
        /* autoplay may wait for gesture — Allow access / stone unlock most sessions */
      });
    };
    play();
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        v.pause();
      } else {
        play();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      v.pause();
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = !soundEnabled;
    v.volume = soundEnabled ? 0.72 : 0;
    if (soundEnabled) {
      void v.play().catch(() => {
        /* need a gesture if autoplay-with-sound is blocked */
      });
    }
  }, [soundEnabled]);

  return (
    <div className="onyx-home-film" aria-hidden>
      <video
        ref={ref}
        autoPlay
        muted={!soundEnabled}
        loop
        playsInline
        preload="auto"
        poster=""
      >
        <source src="/pneuma-home-bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
