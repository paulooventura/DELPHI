"use client";

import { useEffect, useRef } from "react";

/**
 * Home street background — Paulo’s Runway Max loop (public/pneuma-home-bg.mp4).
 * Muted, looping, cover-fit. Pauses when the tab is hidden.
 */
export function OnyxHomeFilm() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const play = () => {
      void v.play().catch(() => {
        /* autoplay may wait for gesture — splash already unlocked most sessions */
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

  return (
    <div className="onyx-home-film" aria-hidden>
      <video
        ref={ref}
        autoPlay
        muted
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
