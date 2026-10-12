"use client";

import { useEffect, useRef } from "react";

export type TreasuryPick = "atlas" | "time" | "senses" | "decompose" | "about" | "oracle" | "welcome";

const ITEMS: { id: TreasuryPick; name: string; note: string; cut: string }[] = [
  { id: "atlas", name: "Atlas", note: "World cycle calendars, side by side", cut: "sapphire" },
  { id: "time", name: "Time units", note: "Helek · ghaṭi · kè · .beat", cut: "citrine" },
  { id: "senses", name: "Senses", note: "What your device can feel right now", cut: "topaz" },
  { id: "decompose", name: "Why this chord", note: "What the moment is made of", cut: "emerald" },
  { id: "about", name: "About", note: "Honesty tiers, privacy and integrity", cut: "amethyst" },
  { id: "oracle", name: "Oracle", note: "The maker's links · research not wired yet", cut: "ruby" },
  { id: "welcome", name: "Replay the welcome", note: "The Pronaos, from the top", cut: "sapphire" },
];

/** Treasury ✦ — the secondary tools, as a sheet over the Omphalos. */
export function TreasurySheet({ onClose, onPick }: { onClose: () => void; onPick: (id: TreasuryPick) => void }) {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="onyx-treasury-wrap" onClick={onClose}>
      <div
        className="onyx-treasury-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Treasury"
        onClick={e => e.stopPropagation()}
      >
        <div className="onyx-treasury-head">
          <button type="button" className="onyx-chamber-back" onClick={onClose}>
            ‹ Omphalos
          </button>
          <p className="onyx-chamber-name">Treasury ✦</p>
          <span aria-hidden />
        </div>
        <p className="onyx-treasury-lede">The instruments behind the four doors.</p>
        <div className="onyx-treasury-list">
          {ITEMS.map((it, i) => (
            <button
              key={it.id}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              className={`onyx-tool-btn onyx-cut-${it.cut}`}
              onClick={() => onPick(it.id)}
            >
              {it.name}
              <span>{it.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
