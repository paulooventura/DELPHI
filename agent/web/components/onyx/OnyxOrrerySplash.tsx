"use client";

/**
 * Clock-entry film — plays when the user swipes into the orrery.
 * Black → film → fade to black → live stacked lanes.
 * Tap skips. Muted autoplay (same contract as boot splash).
 */

import { useEffect, useRef, useState } from "react";

const FADE_MS = 720;
/** Hard cap if `ended` never fires (stalled decode / odd duration). */
const SAFETY_MS = 28_000;

export function OnyxOrrerySplash({ onEnter }: { onEnter: () => void }) {
  const entered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);
  const [markOn, setMarkOn] = useState(false);

  const finish = () => {
    if (entered.current) return;
    entered.current = true;
    setMarkOn(false);
    setVeilOn(true);
    window.setTimeout(() => onEnter(), FADE_MS);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    void v.play().catch(() => {
      /* autoplay blocked — still reveal once a frame is ready */
    });
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    const t = window.setTimeout(() => {
      setVeilOn(false);
      setMarkOn(true);
    }, 180);
    return () => clearTimeout(t);
  }, [videoReady]);

  useEffect(() => {
    const readyFallback = window.setTimeout(() => setVideoReady(true), 2200);
    const safety = window.setTimeout(() => finish(), SAFETY_MS);
    return () => {
      clearTimeout(readyFallback);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Orrery splash"
      onClick={finish}
    >
      <div className="onyx-device onyx-splash-only">
        <div className="onyx-film">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            className={videoReady ? "onyx-film-ready" : undefined}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onEnded={finish}
          >
            <source src="/orrery-intro.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="onyx-grade" aria-hidden />
        <div className="onyx-tint" aria-hidden />
        <div className="onyx-dimmer" aria-hidden />

        <div
          className={`onyx-splash-wordmark${markOn ? " on" : ""}`}
          aria-hidden={!markOn}
        >
          ORRERY
        </div>

        <div
          className={`onyx-splash-veil${veilOn ? " on" : ""}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
