"use client";

import type { CycleReading } from "../lib/worldCycles";

export function NowStrip({
  readings,
  className = "",
}: {
  readings: CycleReading[];
  className?: string;
}) {
  if (!readings.length) return null;
  return (
    <div className={`cp-now-strip ${className}`.trim()} role="list" aria-label="World cycle now">
      {readings.map((r) => (
        <div
          key={r.systemId}
          role="listitem"
          className="cp-now-chip"
          style={{ ["--chip-accent" as string]: r.color }}
          title={`${r.title}: ${r.primary}${r.secondary ? ` · ${r.secondary}` : ""}`}
        >
          <span className="cp-now-chip-icon" aria-hidden>
            {r.icon}
          </span>
          <span className="cp-now-chip-title">{r.title}</span>
          <span className="cp-now-chip-value">{r.primary}</span>
        </div>
      ))}
    </div>
  );
}
