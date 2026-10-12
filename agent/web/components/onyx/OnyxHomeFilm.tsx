"use client";

import { useEffect, useRef } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { omphalosBedPhase } from "../../lib/omphalosBed";

/**
 * Home street background — Paulo's Delphi omphalos seamless loop.
 * Video is silent (public/pneuma-home-omphalos.mp4). Its sound is the app-wide
 * Omphalos bed (lib/omphalosBed.ts), which keeps playing in every chamber; the
 * picture follows that audio clock (playbackRate nudges, a seek when far off).
 */

const VIDEO_SRC = `/pneuma-home-omphalos.mp4?v=${DELPHI_BUILD}`;

/** Beyond this the picture jumps to the audio's phase. */
const RESYNC_OVER_S = 0.3;
/** Inside this window nothing moves. */
const SYNC_DEADBAND_S = 0.03;
const MAX_RATE_NUDGE = 0.06;
/** A stalled picture must not machine-gun seeks. */
const MIN_RESYNC_GAP_MS = 1500;

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
    play();
    const onVis = () => {
      if (document.visibilityState === "hidden") v.pause();
      else play();
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
    let lastSeek = -Infinity;
    const sync = () => {
      const audio = omphalosBedPhase();
      if (!audio || v.paused || v.seeking || v.readyState < 3) {
        if (v.playbackRate !== 1) v.playbackRate = 1;
        return;
      }
      const { phase, period } = audio;
      const t = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      let diff = phase - (((t % period) + period) % period);
      if (diff > period / 2) diff -= period;
      if (diff < -period / 2) diff += period;
      const mag = Math.abs(diff);
      if (mag > RESYNC_OVER_S) {
        const now = performance.now();
        if (now - lastSeek >= MIN_RESYNC_GAP_MS) {
          lastSeek = now;
          v.currentTime = phase;
        }
        v.playbackRate = 1;
      } else if (mag > SYNC_DEADBAND_S) {
        v.playbackRate = 1 + Math.max(-MAX_RATE_NUDGE, Math.min(MAX_RATE_NUDGE, diff * 0.5));
      } else if (v.playbackRate !== 1) {
        v.playbackRate = 1;
      }
    };
    const id = window.setInterval(sync, 250);
    return () => {
      window.clearInterval(id);
      v.playbackRate = 1;
    };
  }, []);

  return (
    <div className="onyx-home-film" aria-hidden>
      <video ref={ref} autoPlay muted loop playsInline preload="auto" poster="">
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}
