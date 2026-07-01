"use client";

import { useMemo } from "react";
import { CosmicClockWheel } from "./CosmicClockWheel";
import { useRealtimeDate } from "../hooks/useRealtimeDate";
import {
  calculateCosmicTime,
  formatStandardDigitalTime,
  type ClockRingData,
} from "../lib/timeEngine";
import { ringAccentColor } from "../lib/cosmicAssets";

export type DashboardContainerProps = {
  className?: string;
};

const RING_ACCENT: Record<number, string> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [i + 1, ringAccentColor(i + 1)]),
) as Record<number, string>;

function formatNumericValue(ring: ClockRingData): string {
  const { ringId, normalizedProgress, activeSegment } = ring;
  const pct = (normalizedProgress * 100).toFixed(1);

  switch (ringId) {
    case 1:
      return `${activeSegment.name} · Sweep: ${pct}%`;
    case 2:
      return `Minute ${activeSegment.numericalValue} · Progress: ${pct}%`;
    case 3:
      return `Hour ${activeSegment.numericalValue} · Progress: ${pct}%`;
    case 4:
      return `Kè ${activeSegment.numericalValue + 1} · Progress: ${pct}%`;
    case 5:
      return `Shí ${activeSegment.numericalValue + 1}/12 · Progress: ${pct}%`;
    case 6:
      return `Phase: ${pct}% · Index ${activeSegment.numericalValue}`;
    case 7:
      return `Year: ${pct}% · Day ${activeSegment.numericalValue}`;
    case 8:
      return `Sign ${activeSegment.numericalValue}/19 · Day: ${pct}%`;
    case 9:
      return `Sign ${activeSegment.numericalValue + 1}/12 · In-sign: ${pct}%`;
    case 10:
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

  const digitalTime = formatStandardDigitalTime(currentDate);

  return (
    <div className={["w-full min-h-0", className].join(" ")}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-lt)]">
            Cosmic Clock Dashboard
          </h2>
          <p className="text-[0.65rem] text-[var(--ink-dim)] mt-0.5">
            Real-time clock · visual engine &amp; playhead readout
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-4 lg:gap-5 items-start">
        <section
          className="min-w-0 rounded-2xl border border-white/[0.08] bg-[var(--void-core)] p-2 sm:p-3"
          aria-label="Visual engine"
        >
          <CosmicClockWheel snapshot={snapshot} showReadout={false} />
        </section>

        <aside
          className="min-w-0 flex flex-col gap-2.5 max-h-[min(72vh,720px)] overflow-y-auto pr-0.5"
          aria-label="Data readout"
        >
          <div className="sticky top-0 z-10 rounded-xl border border-[var(--gold-dp)]/35 bg-[var(--void)]/95 backdrop-blur-sm px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-[var(--gold-dp)]">
              Standard Time
            </p>
            <p
              className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-[var(--gold-lt)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {digitalTime}
            </p>
            <p className="mt-1 text-[0.62rem] text-[var(--ink-dim)]">
              Local civil · synchronized with inner rings
            </p>
          </div>

          {rings.map(ring => (
            <LayerReadoutCard key={ring.ringId} ring={ring} />
          ))}
        </aside>
      </div>
    </div>
  );
}
