"use client";

import { useEffect, useRef } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";

/**
 * Heliodrome chamber background — Paulo’s locked-off void loop
 * (public/pneuma-heliodrome-bg.mp4). Visual only (always muted).
 * File is end→start crossfaded so the join doesn’t flash; timeupdate
 * seeks early as a second seam guard (same pattern as home film).
 */
export function OnyxHeliodromeFilm() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    const play = () => {
      void v.play().catch(() => {
        /* autoplay may wait for gesture */
      });
    };
    const ensureLoop = () => {
      if (!v.duration || !Number.isFinite(v.duration)) return;
      // Crossfade file already overlaps end→start; seek early to avoid a hard cut.
      if (v.currentTime >= v.duration - 0.05) {
        v.currentTime = 0.02;
        play();
      }
    };
    play();
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        v.pause();
      } else {
        play();
      }
    };
    v.addEventListener("timeupdate", ensureLoop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      v.removeEventListener("timeupdate", ensureLoop);
      document.removeEventListener("visibilitychange", onVis);
      v.pause();
    };
  }, []);

  return (
    <div className="onyx-heliodrome-film" aria-hidden>
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster=""
      >
        <source src={`/pneuma-heliodrome-bg.mp4?v=${DELPHI_BUILD}`} type="video/mp4" />
      </video>
    </div>
  );
}
