"use client";

/**
 * Tap-to-reveal for Psyche's parts (Paulo 11-11 §7), like the Heliodrome's jewels: the card shows its name,
 * a tap opens what it is, where it comes from and how sure we are, with the same quiet crystal tap.
 */
import { useState, type ReactNode } from "react";
import { getClockAudio, playCrystalTap } from "../../lib/clockSfx";

export type RevealRow = { label: string; text: string };

export function PsycheReveal({
  title,
  sub,
  rows,
  degree = 0,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  rows: RevealRow[];
  /** NOW-Chord degree for the tap sound. */
  degree?: number;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = rows.filter(r => r.text);
  return (
    <article className={`onyx-decomp-card onyx-you-voice onyx-reveal${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="onyx-reveal-head"
        aria-expanded={open}
        disabled={!shown.length}
        onClick={() => {
          if (!open) {
            const audio = getClockAudio();
            if (audio) playCrystalTap(audio, degree);
          }
          setOpen(o => !o);
        }}
      >
        <span className="onyx-decomp-name">
          {title}
          {sub ? <span>{sub}</span> : null}
        </span>
        {shown.length ? <span className="onyx-reveal-mark" aria-hidden>{open ? "–" : "+"}</span> : null}
      </button>
      {children}
      {open ? (
        <dl className="onyx-reveal-body">
          {shown.map(r => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
