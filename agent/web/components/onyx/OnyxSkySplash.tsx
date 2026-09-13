"use client";

/**
 * Aether entry plate — still image splash when opening the sky map.
 * Black → plate → hold → fade to live sky. Tap skips. Once per tab session.
 */

import { useEffect, useRef, useState } from "react";

const FADE_MS = 720;
/** Hold on the plate before auto-entering the live sky. */
const HOLD_MS = 2800;

export function OnyxSkySplash({ onEnter }: { onEnter: () => void }) {
  const entered = useRef(false);
  const [ready, setReady] = useState(false);
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
    if (!ready) return;
    const t = window.setTimeout(() => {
      setVeilOn(false);
      setMarkOn(true);
    }, 160);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    const readyFallback = window.setTimeout(() => setReady(true), 900);
    const hold = window.setTimeout(() => finish(), HOLD_MS + 400);
    return () => {
      clearTimeout(readyFallback);
      clearTimeout(hold);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Aether splash"
      onClick={finish}
    >
      <div className="onyx-device onyx-splash-only">
        <div className="onyx-film onyx-sky-splash-film">
          <img
            className={ready ? "onyx-film-ready" : undefined}
            src="/aether-sky-splash.jpg"
            alt=""
            draggable={false}
            onLoad={() => setReady(true)}
          />
        </div>

        <div className="onyx-grade" aria-hidden />
        <div className="onyx-tint" aria-hidden />
        <div className="onyx-dimmer" aria-hidden />

        <div
          className={`onyx-splash-wordmark${markOn ? " on" : ""}`}
          aria-hidden={!markOn}
        >
          AETHER
        </div>

        <div className={`onyx-splash-veil${veilOn ? " on" : ""}`} aria-hidden />
      </div>
    </div>
  );
}
