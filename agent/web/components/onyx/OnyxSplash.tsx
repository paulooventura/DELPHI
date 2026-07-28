"use client";

import { useEffect, useRef, useState } from "react";

const FADE_MS = 720;

/**
 * Boot: pure black → fade in intro video (never a poster / brand still) →
 * fade to black → parent mounts HOME.
 * Splash chrome is only the centered DELPHI wordmark over the film.
 */
export function OnyxSplash({ onEnter }: { onEnter: () => void }) {
  const entered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  /** Black veil: starts on, lifts for splash, returns for exit. */
  const [veilOn, setVeilOn] = useState(true);
  const [chromeOn, setChromeOn] = useState(false);

  const finish = () => {
    if (entered.current) return;
    entered.current = true;
    setChromeOn(false);
    setVeilOn(true);
    window.setTimeout(() => onEnter(), FADE_MS);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => {
      void v.play().catch(() => {
        /* autoplay blocked — still fade in once metadata is there */
      });
    };
    tryPlay();
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    // Hold black a beat, then fade into the video.
    const t = window.setTimeout(() => {
      setVeilOn(false);
      setChromeOn(true);
    }, 180);
    return () => clearTimeout(t);
  }, [videoReady]);

  // Safety: if the video never fires, don't leave the user on black forever.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setVideoReady(true);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Delphi splash"
      onClick={finish}
    >
      <div className="onyx-device">
        <div className="onyx-film">
          {/* No poster. Opacity 0 until a real frame is playing — no brand still. */}
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
            <source src="/delphi-intro.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="onyx-grade" />
        <div className="onyx-tint" />
        <div className="onyx-dimmer" />

        <div
          className={`onyx-splash-chrome${chromeOn ? " on" : ""}`}
          aria-hidden={!chromeOn}
        >
          <div className="onyx-splash-wordmark">
            <div className="name">DELPHI</div>
          </div>
        </div>

        {/* Solid black veil — first paint and exit. Never an image. */}
        <div
          className={`onyx-splash-veil${veilOn ? " on" : ""}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
