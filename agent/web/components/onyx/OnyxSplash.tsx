"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function fmtCoord(lat: number, lon: number): { n: string; w: string } {
  const n = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const w = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  return { n, w };
}

const FADE_MS = 720;

/**
 * Boot: pure black → fade in intro video (never a poster / brand still) →
 * fade to black → parent mounts HOME.
 */
export function OnyxSplash({
  now,
  lat,
  lon,
  altM,
  acknowledgment,
  onEnter,
}: {
  now: Date;
  lat: number;
  lon: number;
  altM?: number | null;
  acknowledgment?: { people: string; text: string; pointTo: string } | null;
  onEnter: () => void;
}) {
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

  const { n, w } = fmtCoord(lat, lon);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tz = now.toLocaleTimeString([], { timeZoneName: "short" }).split(" ").pop() ?? "";
  const seeds = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const top = Math.pow((i * 0.37) % 1, 1.5) * 70;
        const left = (i * 47) % 100;
        const s = i % 5 === 0 ? 1.4 + (i % 3) * 0.3 : 0.5 + (i % 4) * 0.2;
        const o = 0.3 + (i % 5) * 0.08;
        const sd = 2 + (i % 6) * 0.4;
        const tw = 3 + (i % 5);
        return { top, left, s, o, sd, tw, key: i };
      }),
    [],
  );

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
          {seeds.map(s => (
            <span
              key={s.key}
              className="onyx-seed"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: s.s,
                height: s.s,
                ["--o" as string]: s.o,
                ["--sd" as string]: `${s.sd}s`,
                ["--tw" as string]: `${s.tw}s`,
              }}
            />
          ))}

          <div className="onyx-splash-wordmark">
            <div className="name">DELPHI</div>
            <div className="tag">WORLD CYCLES · PRECISE TO THE ARCMINUTE</div>
          </div>
          <div className="onyx-horizon" />

          <span className="onyx-fix tl">{n}</span>
          <span className="onyx-fix tr">{w}</span>
          <span className="onyx-fix bl">
            ALT {altM != null && Number.isFinite(altM) ? `${Math.round(altM)}M` : "—"}
          </span>
          <span className="onyx-fix br">
            {time} {tz}
          </span>

          {acknowledgment && (
            <p
              className="onyx-land-ack"
              title={acknowledgment.people}
              onClick={e => e.stopPropagation()}
            >
              {acknowledgment.text}{" "}
              <a href={acknowledgment.pointTo} target="_blank" rel="noopener noreferrer">
                learn more ↗
              </a>
            </p>
          )}

          <div className="onyx-enter">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                finish();
              }}
            >
              tune in ↗
            </button>
            <span className="pulse">tap to skip · plays once</span>
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
