"use client";

import { useState } from "react";
import { castReading, CAST_FRAMING, type CastResult } from "../../lib/lore/cast";
import { CAST_SYSTEMS } from "../../lib/lore/qualia";

/** Side-door divination. Never wired into the home chord. drawIndex stays in cast.ts. */
export function OnyxCast({ onBack }: { onBack: () => void }) {
  const [result, setResult] = useState<CastResult | null>(null);

  function draw(system: string) {
    // castReading → cast → drawIndex (crypto + rejection). Do not replace.
    setResult(castReading(system, 1));
  }

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
              return (
                <button
                  key={system}
                  type="button"
                  className="onyx-tool-btn"
                  onClick={() => draw(system)}
                >
                  {framing?.label ?? system}
                  <span>{framing?.frame}</span>
                </button>
              );
            })}
          </div>

          {result && (
            <div className="onyx-cast-result">
              <p className="onyx-eyebrow">{result.framing.label}</p>
              <p className="onyx-layer-phrase">
                {result.drawn[0]?.name ?? "—"}
              </p>
              <p className="onyx-cast-frame">{result.framing.frame}</p>
              <p className="onyx-layer-meta">{result.framing.note}</p>
              {result.drawn[0]?.source && (
                <p className="onyx-layer-meta" style={{ marginTop: 12 }}>
                  {result.drawn[0].source}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
