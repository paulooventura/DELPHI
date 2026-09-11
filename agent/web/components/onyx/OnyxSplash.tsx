"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Boot: pure black → intro film → last frame holds into the access gate.
 * Runway splash carries Pneuma Mundi typography in-frame — no second title overlay.
 * Tap can re-run device access on the user-gesture path (required on iOS)
 * when this session already granted. First ask lives on the permissions
 * screen after this splash.
 */
export function OnyxSplash({
  onEnter,
  onPrimeAccess,
}: {
  onEnter: () => void;
  /** Sync call from the tap handler — must not be deferred past the gesture. */
  onPrimeAccess?: () => void;
}) {
  const entered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);

  const finish = (fromGesture: boolean) => {
    if (entered.current) return;
    entered.current = true;
    if (fromGesture) onPrimeAccess?.();
    onEnter();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    void v.play().catch(() => {
      /* autoplay blocked — still fade in once metadata is there */
    });
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    const t = window.setTimeout(() => {
      setVeilOn(false);
    }, 180);
    return () => clearTimeout(t);
  }, [videoReady]);

  useEffect(() => {
    const t = window.setTimeout(() => setVideoReady(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Pneuma Mundi splash"
      onClick={() => finish(true)}
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
            onEnded={() => finish(false)}
          >
            <source src="/pneuma-intro.mp4" type="video/mp4" />
            <source src="/delphi-intro.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="onyx-grade" aria-hidden />
        <div className="onyx-tint" aria-hidden />
        <div className="onyx-dimmer" aria-hidden />

        <div
          className={`onyx-splash-veil${veilOn ? " on" : ""}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
