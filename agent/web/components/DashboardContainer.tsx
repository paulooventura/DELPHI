"use client";

import { useMemo } from "react";
import { CosmicClockWheel } from "./CosmicClockWheel";
import { useRealtimeDate } from "../hooks/useRealtimeDate";
import { calculateCosmicTime, type ClockRingData } from "../lib/timeEngine";

export type DashboardContainerProps = {
  className?: string;
};

const RING_ACCENT: Record<number, string> = {
  1: "#fbbf24",
  2: "#f97316",
  3: "#94a3b8",
  4: "#22d3ee",
  5: "#7c3aed",
  6: "#e879f9",
  7: "#dc2626",
};

function formatNumericValue(ring: ClockRingData): string {
  const { ringId, normalizedProgress, activeSegment } = ring;
  const pct = (normalizedProgress * 100).toFixed(1);

  switch (ringId) {
    case 1:
      return `Kè ${activeSegment.numericalValue + 1} · Progress: ${pct}%`;
    case 2:
      return `Shí ${activeSegment.numericalValue + 1}/12 · Progress: ${pct}%`;
    case 3:
      return `Phase: ${pct}% · Index ${activeSegment.numericalValue}`;
    case 4:
      return `Year progress: ${pct}% · Day ${activeSegment.numericalValue}`;
    case 5:
      return `Sign ${activeSegment.numericalValue}/19 · Day: ${pct}%`;
    case 6:
      return `Sign ${activeSegment.numericalValue + 1}/12 · In-sign: ${pct}%`;
    case 7:
      return `Cycle index ${activeSegment.numericalValue}/59 · Progress: ${pct}%`;
    default:
      return `Progress: ${pct}%`;
  }
}

function LayerReadoutCard({ ring }: { ring: ClockRingData }) {
  const accent = RING_ACCENT[ring.ringId] ?? "var(--gold-dp)";

  return (
    <article
      className="group relative min-w-0 rounded-xl border border-white/[0.08] bg-[var(--panel2)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/[0.14]"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--gold-dp)]">
        Layer {ring.ringId}: {ring.name}
      </p>

      <div className="mt-2 flex items-center gap-2.5 min-w-0">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ background: `${accent}22`, color: accent }}
          aria-hidden
        >
          {ring.activeSegment.symbol}
        </span>
        <p className="text-sm font-semibold text-[var(--ink)] leading-snug truncate">
          {ring.activeSegment.name}
        </p>
      </div>

      <p className="mt-2 text-xs font-medium text-[var(--ink)] tabular-nums">
        {formatNumericValue(ring)}
      </p>

      <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--ink-dim)]">
        {ring.activeSegment.metadata}
      </p>
    </article>
  );
}

export function DashboardContainer({ className = "" }: DashboardContainerProps) {
  const currentDate = useRealtimeDate();
  const snapshot = useMemo(() => calculateCosmicTime(currentDate), [currentDate]);

  const rings = useMemo(
    () => [...snapshot.rings].sort((a, b) => a.ringId - b.ringId),
    [snapshot.rings],
  );

  const timeLabel = currentDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const msLabel = String(currentDate.getMilliseconds()).padStart(3, "0");

  return (
    <div
      className={[
        "w-full min-h-0",
        className,
      ].join(" ")}
    >
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-lt)]">
            Cosmic Clock Dashboard
          </h2>
          <p className="text-[0.65rem] text-[var(--ink-dim)] mt-0.5">
            Visual engine &amp; playhead readout · synchronized live
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {timeLabel}
          <span className="text-[var(--ink-dim)] font-normal">.{msLabel}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-4 lg:gap-5 items-start">
        <section
          className="min-w-0 rounded-2xl border border-white/[0.08] bg-[var(--void-core)] p-2 sm:p-3"
          aria-label="Visual engine"
        >
          <CosmicClockWheel snapshot={snapshot} showReadout={false} />
        </section>

        <aside
          className="min-w-0 flex flex-col gap-2.5 max-h-[min(72vh,720px)] overflow-y-auto pr-0.5 scrollbar-thin"
          aria-label="Data readout"
        >
          {rings.map(ring => (
            <LayerReadoutCard key={ring.ringId} ring={ring} />
          ))}
        </aside>
      </div>
    </div>
  );
}
