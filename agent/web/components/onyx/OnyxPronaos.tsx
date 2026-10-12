"use client";

import { useEffect, useState } from "react";

const WELCOMED_KEY = "pm-welcomed";

export function hasBeenWelcomed(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(WELCOMED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, "1");
  } catch {
    /* private mode */
  }
}

const ARMS = [
  { pos: "up", name: "Aether", note: "the living sky" },
  { pos: "right", name: "Heliodrome", note: "the clocks of the world" },
  { pos: "down", name: "Agon", note: "gatherings" },
  { pos: "left", name: "Mouseion", note: "the library" },
] as const;

const ARM_MS = 1400;

/** Pronaos — the entrance porch. Three beats over the dimmed home, once per device. */
export function OnyxPronaos({ onDone }: { onDone: (meetYourself: boolean) => void }) {
  const [beat, setBeat] = useState(0);
  const [arm, setArm] = useState(0);

  useEffect(() => {
    if (beat !== 1) return;
    const id = window.setInterval(() => setArm(a => (a + 1) % ARMS.length), ARM_MS);
    return () => window.clearInterval(id);
  }, [beat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDone(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  const next = () => {
    if (beat < 2) setBeat(beat + 1);
    else onDone(true);
  };

  return (
    <div className="onyx-pronaos" role="dialog" aria-modal="true" aria-label="Welcome" onClick={next}>
      <button
        type="button"
        className="onyx-pronaos-skip"
        onClick={e => {
          e.stopPropagation();
          onDone(false);
        }}
      >
        Skip
      </button>

      {beat === 0 && (
        <div className="onyx-pronaos-beat">
          <p className="onyx-pronaos-inscription" lang="grc">ΓΝΩΘΙ ΣΑΥΤΟΝ</p>
          <p className="onyx-pronaos-line">This is the Omphalos, the centre of the world.</p>
          <p className="onyx-pronaos-sub">Above it, carved at Delphi: Know Thyself.</p>
        </div>
      )}

      {beat === 1 && (
        <div className="onyx-pronaos-beat">
          <p className="onyx-pronaos-line">The gem is a compass.</p>
          <div className="onyx-pronaos-cross" aria-hidden>
            {ARMS.map((a, i) => (
              <span key={a.pos} className={`onyx-pronaos-arm is-${a.pos}${i === arm ? " is-lit" : ""}`}>
                {a.name}
              </span>
            ))}
            <span className="onyx-pronaos-gem" />
          </div>
          <p className="onyx-pronaos-sub" aria-live="polite">
            {ARMS[arm]!.name} · {ARMS[arm]!.note}
          </p>
          <p className="onyx-pronaos-hint">Hold the gem and drag toward a door, or tap a silver bow.</p>
        </div>
      )}

      {beat === 2 && (
        <div className="onyx-pronaos-beat">
          <span className="onyx-pronaos-gem is-solo" aria-hidden />
          <p className="onyx-pronaos-line">Tap the centre to meet yourself.</p>
          <p className="onyx-pronaos-sub">Psyche reads who you are. What you enter stays on this device unless you turn on encrypted backup.</p>
        </div>
      )}

      <p className="onyx-pronaos-step" aria-hidden>
        {beat + 1} / 3 · tap to continue
      </p>
    </div>
  );
}
