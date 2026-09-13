"use client";

import { useEffect, useRef } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";

/**
 * Home street background — Paulo’s Runway Max loop (public/pneuma-home-bg.mp4).
 * Visual only (always muted). Soundtrack is OnyxSymphonyBed — stays on across chambers
 * and layers with the Heliodrome NOW-Chord as the app symphony.
 * File is end→start crossfaded so loop joins without a flash.
 */
export function OnyxHomeFilm() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    const play = () => {
      void v.play().catch(() => {
        /* autoplay may wait for gesture */
      });
    };
    const ensureLoop = () => {
      if (!v.duration || !Number.isFinite(v.duration)) return;
      if (v.currentTime >= v.duration - 0.04) {
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
        <source src={`/pneuma-home-bg.mp4?v=${DELPHI_BUILD}`} type="video/mp4" />
      </video>
    </div>
  );
}
