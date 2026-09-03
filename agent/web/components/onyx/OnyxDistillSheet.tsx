"use client";

import {
  BRAIN_ROWS,
  DEPTH_ROWS,
  VOICE_ROWS,
  anyBrain,
  listedBrains,
  type BrainAvailability,
  type DistillPrefs,
} from "../../lib/lore/distillPrefs";

export function OnyxDistillSheet({
  prefs,
  brains,
  onChange,
  onClose,
}: {
  prefs: DistillPrefs;
  brains: BrainAvailability | null;
  onChange: (next: DistillPrefs) => void;
  onClose: () => void;
}) {
  const keyed = anyBrain(brains);
  const minds = listedBrains(brains);

  return (
    <div
      className="onyx-share-scrim"
      role="presentation"
      onPointerDown={e => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="onyx-share-sheet onyx-distill-sheet"
        role="dialog"
        aria-label="How this moment speaks"
        onPointerDown={e => e.stopPropagation()}
      >
        <p className="onyx-share-kicker">Distill this moment</p>
        <p className="onyx-distill-lede">
          The sky math stays. You choose the mouth.
        </p>

        <div className="onyx-distill-cluster">
          {VOICE_ROWS.map(row => (
            <button
              key={row.id}
              type="button"
              className={`onyx-distill-pick${prefs.voice === row.id ? " on" : ""}`}
              onClick={() => onChange({ ...prefs, voice: row.id })}
            >
              <span className="onyx-distill-pick-name">{row.label}</span>
              <span className="onyx-distill-pick-feel">{row.feel}</span>
            </button>
          ))}
        </div>

        {keyed && (
          <>
            <p className="onyx-share-kicker onyx-distill-kicker-2">Depth</p>
            <div className="onyx-distill-split">
              {DEPTH_ROWS.map(row => (
                <button
                  key={row.id}
                  type="button"
                  className={`onyx-distill-pick${prefs.depth === row.id ? " on" : ""}`}
                  onClick={() => onChange({ ...prefs, depth: row.id })}
                >
                  <span className="onyx-distill-pick-name">{row.label}</span>
                  <span className="onyx-distill-pick-feel">{row.feel}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {keyed && prefs.depth === "deep" && minds.length > 1 && (
          <>
            <p className="onyx-share-kicker onyx-distill-kicker-2">Mind</p>
            <div className="onyx-distill-minds">
              {BRAIN_ROWS.filter(r => r.id === "auto" || minds.includes(r.id as typeof minds[number])).map(row => (
                <button
                  key={row.id}
                  type="button"
                  className={`onyx-layer-chip${prefs.brain === row.id ? " on" : ""}`}
                  onClick={() => onChange({ ...prefs, brain: row.id })}
                >
                  {row.label}
                </button>
              ))}
            </div>
          </>
        )}

        {!keyed && (
          <p className="onyx-distill-note">
            Spark is live. Deep mind wakes when a key is on the server.
          </p>
        )}

        <button type="button" className="onyx-share-cancel" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
