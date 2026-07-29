"use client";

import type { QualiaEntry } from "../../lib/lore/qualia";
import { symbolForCastEntry } from "../../lib/cast/realms";
import { CastSymbol } from "./CastSymbol";

export function CastCard({
  entry,
  system,
  frame,
}: {
  entry: QualiaEntry;
  system: string;
  frame: string;
}) {
  const spec = symbolForCastEntry(system, entry.id, entry.glyph);
  const title = entry.name.toUpperCase();

  return (
    <article className="onyx-cast-card" aria-label={`${entry.name} — ${frame}`}>
      <div className="onyx-cast-card-face">
        <div className="onyx-cast-card-aura" aria-hidden />
        <div className="onyx-cast-card-symbol-wrap">
          <CastSymbol spec={spec} size={168} />
        </div>
        <div className="onyx-cast-card-band">
          <p className="onyx-cast-card-title">{title}</p>
        </div>
      </div>
      {entry.qualities.length > 0 && (
        <p className="onyx-cast-card-qualities">{entry.qualities.slice(0, 5).join(" · ")}</p>
      )}
      {entry.observed && <p className="onyx-cast-card-observed">{entry.observed}</p>}
    </article>
  );
}
