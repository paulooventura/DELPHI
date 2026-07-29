"use client";

import { useEffect, useRef, useState } from "react";
import {
  castReading,
  CAST_FRAMING,
  CAST_RITUAL_VIDEO,
  type CastResult,
} from "../../lib/lore/cast";
import { CAST_SYSTEMS } from "../../lib/lore/qualia";
import { CastCard } from "./CastCard";

const RITUAL_FADE_MS = 480;

/**
 * Side-door divination. Never wired into the home chord.
 * Tap a tradition → ritual film → crypto draw reveal (vector card).
 */
export function OnyxCast({ onBack }: { onBack: () => void }) {
  const [result, setResult] = useState<CastResult | null>(null);
  const [ritual, setRitual] = useState<{
    system: string;
    src: string;
    pending: CastResult;
  } | null>(null);
  const [ritualVeil, setRitualVeil] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const pendingRef = useRef<CastResult | null>(null);

  function revealCast() {
    if (finished.current || !pendingRef.current) return;
    finished.current = true;
    const pending = pendingRef.current;
    setRitualVeil(true);
    window.setTimeout(() => {
      setResult(pending);
      setRitual(null);
      setRitualVeil(false);
      pendingRef.current = null;
    }, RITUAL_FADE_MS);
  }

  function beginCast(system: string) {
    const src = CAST_RITUAL_VIDEO[system];
    // Draw at the gesture — crypto entropy locks now; film is the ritual.
    const pending = castReading(system, 1);
    finished.current = false;
    pendingRef.current = pending;
    setResult(null);
    if (!src) {
      setResult(pending);
      pendingRef.current = null;
      return;
    }
    setRitual({ system, src, pending });
    setRitualVeil(false);
  }

  useEffect(() => {
    if (!ritual) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    void v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => {
        revealCast();
      });
    });
    const safety = window.setTimeout(() => revealCast(), 28000);
    return () => window.clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when film src changes
  }, [ritual?.src]);

  if (ritual) {
    const framing = CAST_FRAMING[ritual.system];
    return (
      <div className="onyx-root">
        <div className="onyx-device onyx-cast-ritual" onClick={revealCast}>
          <button
            type="button"
            className="onyx-overlay-close"
            onClick={e => {
              e.stopPropagation();
              onBack();
            }}
          >
            close
          </button>
          <div className="onyx-cast-film">
            <video
              ref={videoRef}
              key={ritual.src}
              playsInline
              preload="auto"
              onEnded={revealCast}
            >
              <source src={ritual.src} type="video/mp4" />
            </video>
          </div>
          <div className="onyx-cast-ritual-grade" aria-hidden />
          <p className="onyx-cast-ritual-label">{framing?.label ?? ritual.system}</p>
          <p className="onyx-cast-ritual-hint">tap to reveal</p>
          <div className={`onyx-splash-veil${ritualVeil ? " on" : ""}`} aria-hidden />
        </div>
      </div>
    );
  }

  const drawn = result?.drawn[0] ?? null;

  return (
    <div className="onyx-root">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-overlay">
          <p className="onyx-eyebrow">CAST</p>
          <p className="onyx-layer-lead">
            A genuine draw — cryptographic random, not the sky clock. Off by default. Choose a
            tradition, or none.
          </p>

          <div className="onyx-tools-grid">
            {CAST_SYSTEMS.map(system => {
              const framing = CAST_FRAMING[system];
              const active = result?.system === system;
              return (
                <button
                  key={system}
                  type="button"
                  className={`onyx-tool-btn${active ? " on" : ""}`}
                  onClick={() => beginCast(system)}
                >
                  {framing?.label ?? system}
                  <span>{framing?.frame}</span>
                </button>
              );
            })}
          </div>

          {result && drawn && (
            <div className="onyx-cast-result">
              <p className="onyx-eyebrow">{result.framing.label}</p>
              <p className="onyx-cast-frame">{result.framing.frame}</p>
              <CastCard entry={drawn} system={result.system} frame={result.framing.frame} />
              <p className="onyx-layer-meta">{result.framing.note}</p>
              {drawn.source && (
                <p className="onyx-layer-meta" style={{ marginTop: 12 }}>
                  {drawn.source}
                </p>
              )}
              <button
                type="button"
                className="onyx-ghost-btn"
                style={{ marginTop: 16 }}
                onClick={() => beginCast(result.system)}
              >
                Cast again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
