"use client";

import { PmDialog } from "./PmDialog";

export type TreasuryPick = "atlas" | "time" | "senses" | "decompose" | "about" | "oracle" | "welcome";

const ITEMS: { id: TreasuryPick; name: string; note: string }[] = [
  { id: "atlas", name: "Atlas", note: "World cycle calendars, side by side" },
  { id: "time", name: "Time units", note: "Helek · ghaṭi · kè · .beat" },
  { id: "senses", name: "Senses", note: "What your device can feel right now" },
  { id: "decompose", name: "Why this chord", note: "What the moment is made of" },
  { id: "about", name: "About", note: "How we know what we show, and your privacy" },
  { id: "oracle", name: "Oracle", note: "The maker's links" },
  { id: "welcome", name: "Replay the welcome", note: "The Pronaos, from the top" },
];

/** Treasury — the secondary tools, in the shared dialog over the Omphalos. */
export function TreasurySheet({ onClose, onPick }: { onClose: () => void; onPick: (id: TreasuryPick) => void }) {
  return (
    <PmDialog title="Treasury" size="m" onClose={onClose} closeLabel="Back to the Omphalos">
      <p className="pm-dialog-lede">The instruments behind the four doors.</p>
      <div className="pm-list">
        {ITEMS.map(it => (
          <button key={it.id} type="button" className="pm-row" onClick={() => onPick(it.id)}>
            {it.name}
            <span>{it.note}</span>
          </button>
        ))}
      </div>
    </PmDialog>
  );
}
