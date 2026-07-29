"use client";

import { decompose, type Composition } from "../../lib/lore/compose";

/** "Tap to see why" — provenance intact: source + claim verbatim. */
export function OnyxDecompose({
  chord,
  onBack,
}: {
  chord: Composition;
  onBack: () => void;
}) {
  const rows = decompose(chord);

  return (
    <div className="onyx-root">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-overlay">
          <p className="onyx-eyebrow">WHY THIS CHORD</p>
          <p className="onyx-layer-lead">
            The home sentence named the chord — the sum. Here is each voice that built it:
            provenance intact, nothing invented after the fact.
          </p>

          {chord.resonances.slice(0, 3).map(r => (
            <p key={`r-${r.axis}`} className="onyx-layer-meta">
              Resonance · {r.axis} · {r.entries.join(", ")}
            </p>
          ))}
          {chord.tensions.slice(0, 3).map(t => (
            <p key={`t-${t.axis}`} className="onyx-layer-meta">
              Tension · {t.axis} · {t.poles.map(p => `${p.name} (${p.system})`).join(" vs ")}
            </p>
          ))}

          <hr className="onyx-seam" />

          {rows.map(({ entry, contributes }) => {
            const natureLabel =
              entry.nature === "cast"
                ? "drawn"
                : entry.nature === "birth"
                  ? "natal"
                  : "moment";
            return (
              <article key={entry.id} className="onyx-decomp-card">
                <p className="onyx-decomp-name">
                  {entry.name}
                  <span>
                    {natureLabel} · {entry.system}
                  </span>
                </p>
                <p className="onyx-layer-meta">{contributes.join(" · ") || "—"}</p>
                {entry.source && (
                  <p className="onyx-decomp-source">{entry.source}</p>
                )}
                <p className="onyx-decomp-claim">claim · {entry.claim}</p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
