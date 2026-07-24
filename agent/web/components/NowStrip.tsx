"use client";

import { useEffect, useState } from "react";
import type { CycleReading } from "../lib/worldCycles";
import { CLAIM_LABEL } from "../lib/design/claimMarks";
/* Sheet chrome lives with the senses styles so one visual language covers both. */
import "./sensorArray.css";

export function NowStrip({
  readings,
  className = "",
}: {
  readings: CycleReading[];
  className?: string;
}) {
  const [open, setOpen] = useState<CycleReading | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!readings.length) return null;

  return (
    <>
      <div className={`cp-now-strip ${className}`.trim()} role="list" aria-label="World cycle now">
        {readings.map((r) => (
          <button
            key={r.systemId}
            type="button"
            role="listitem"
            className="cp-now-chip cp-now-chip-tappable"
            style={{ ["--chip-accent" as string]: r.color }}
            title={`${r.title}: ${r.primary}${r.secondary ? ` · ${r.secondary}` : ""} — tap for detail`}
            onClick={() => setOpen(r)}
          >
            <span className="cp-now-chip-icon" aria-hidden>
              {r.icon}
            </span>
            <span className="cp-now-chip-title">{r.title}</span>
            <span className="cp-now-chip-value">{r.primary}</span>
          </button>
        ))}
      </div>

      {open ? (
        <div className="cp-sense-sheet-root" role="presentation">
          <button
            type="button"
            className="cp-sense-sheet-backdrop"
            aria-label="Close"
            onClick={() => setOpen(null)}
          />
          <div
            className="cp-sense-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-cycle-sheet-title"
          >
            <header className="cp-sense-sheet-head">
              <span className="cp-sense-sheet-glyph" aria-hidden>
                {open.icon}
              </span>
              <div>
                <h2 id="cp-cycle-sheet-title">
                  {open.title}
                  {open.canonical ? (
                    <span className="cp-cycle-sheet-canon"> canonical</span>
                  ) : null}
                </h2>
                <p className="cp-sense-sheet-live">
                  <strong>{open.primary}</strong>
                  {open.secondary ? ` · ${open.secondary}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="cp-sense-sheet-close"
                onClick={() => setOpen(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="cp-sense-sheet-body">
              <section>
                <h3>Claim</h3>
                <p>
                  {CLAIM_LABEL[open.claim]} · {open.accuracy} precision
                  {open.canonical
                    ? " — this is the reading that stays true to the math among its peers."
                    : "."}
                </p>
              </section>
              {open.sources.length > 0 ? (
                <section>
                  <h3>Sources</h3>
                  <p>{open.sources.join("; ")}</p>
                </section>
              ) : null}
              {Object.keys(open.meta).length > 0 ? (
                <section>
                  <h3>Detail</h3>
                  <ul className="cp-cycle-sheet-meta">
                    {Object.entries(open.meta).map(([k, v]) => (
                      <li key={k}>
                        <span>{k}</span>
                        <strong>{String(v)}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section>
                <h3>Cultural place</h3>
                <p>
                  {open.region.length ? open.region.join(" · ") : "global"} · {open.family} · tier{" "}
                  {open.tier}
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
