"use client";

import { useMemo } from "react";
import { CosmicClockWheel } from "./CosmicClockWheel";
import { useRealtimeDate } from "../hooks/useRealtimeDate";
import {
  calculateCosmicTime,
  dashboardLayerNumber,
  DASHBOARD_COSMIC_LAYER_IDS,
  formatHubClockTime,
  formatStandardDigitalTime,
  type ClockRingData,
} from "../lib/timeEngine";
import { COSMIC_ASSETS, ringAccentColor, segmentGraphicKey } from "../lib/cosmicAssets";
import { CosmicGraphicBadge } from "../lib/cosmicGraphicIcons";

export type DashboardContainerProps = {
  className?: string;
};

function parseToneFromMetadata(metadata: string): number | null {
  const m = metadata.match(/Tone (\d+)/);
  return m ? Number(m[1]) : null;
}

function ProgressBar({ value, accent }: { value: number; accent: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-150 ease-linear"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}99, ${accent})` }}
      />
    </div>
  );
}

function formatNumericValue(ring: ClockRingData): string {
  const { ringId, normalizedProgress, activeSegment } = ring;
  const pct = (normalizedProgress * 100).toFixed(1);

  switch (ringId) {
    case 4:
      return `Kè ${activeSegment.numericalValue + 1} · Progress: ${pct}%`;
    case 5:
      return `Shí ${activeSegment.numericalValue + 1}/12 · Progress: ${pct}%`;
    case 6:
      return `Phase: ${pct}% · Index ${activeSegment.numericalValue}`;
    case 7:
      return `Year progress: ${pct}% · Day ${activeSegment.numericalValue}`;
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

function LayerReadoutCard({ ring, hubTime }: { ring: ClockRingData; hubTime: string }) {
  const accent = ringAccentColor(ring.ringId);
  const layerNum = dashboardLayerNumber(ring.ringId);
  const isKe = ring.ringId === 4;
  const isMayan = ring.ringId === 8;
  const tone = isMayan ? parseToneFromMetadata(ring.activeSegment.metadata) : null;

  return (
    <article
      className="group relative min-w-0 rounded-xl border border-white/[0.1] bg-[#0d1118]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--gold-dp)]">
        Layer {layerNum}: {ring.name}
      </p>

      {isKe ? (
        <p className="mt-2 text-sm font-semibold text-[var(--ink)] tabular-nums">
          <span className="text-[var(--gold-lt)]">刻</span> Kè {ring.activeSegment.numericalValue + 1}
          <span className="text-[var(--ink-dim)] font-normal"> · {hubTime.replace(/^NOW\s/, "")}</span>
        </p>
      ) : (
        <div className="mt-2 flex items-start gap-3 min-w-0">
          {(() => {
            const graphicKey = segmentGraphicKey(ring.ringId, ring.activeSegment.numericalValue);
            return graphicKey ? (
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10"
                style={{ background: `${accent}18` }}
                aria-hidden
              >
                <CosmicGraphicBadge graphicKey={graphicKey} color={accent} />
              </span>
            ) : (
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl border border-white/10"
                style={{ background: `${accent}18`, color: accent }}
                aria-hidden
              >
                {ring.activeSegment.symbol}
              </span>
            );
          })()}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--ink)] leading-snug">
              {ring.activeSegment.name}
            </p>
            <p className="mt-1 text-xs font-medium text-[var(--ink)] tabular-nums">
              {formatNumericValue(ring)}
            </p>
          </div>
          {isMayan && tone != null && (
            <div className="shrink-0 rounded-lg border border-[var(--gold-dp)]/30 bg-[#0a0a0c] px-2 py-1.5 text-center">
              <p className="text-[0.45rem] uppercase tracking-widest text-[var(--gold-dp)]">Tone</p>
              <div
                className="mx-auto mt-0.5 w-6 h-8 [&_svg]:w-full [&_svg]:h-full"
                dangerouslySetInnerHTML={{ __html: COSMIC_ASSETS.mayan.renderNumeral(tone) }}
              />
            </div>
          )}
        </div>
      )}

      {!isKe && <ProgressBar value={ring.normalizedProgress} accent={accent} />}

      {isKe && <ProgressBar value={ring.normalizedProgress} accent={accent} />}

      <p className="mt-2.5 text-[0.68rem] leading-relaxed text-[var(--ink-dim)]">
        {ring.activeSegment.metadata}
      </p>
    </article>
  );
}

export function DashboardContainer({ className = "" }: DashboardContainerProps) {
  const currentDate = useRealtimeDate();
  const snapshot = useMemo(() => calculateCosmicTime(currentDate), [currentDate]);
  const hubTime = formatHubClockTime(currentDate);
  const digitalTime = formatStandardDigitalTime(currentDate);

  const cosmicLayers = useMemo(() => {
    const byId = new Map(snapshot.rings.map(r => [r.ringId, r]));
    return DASHBOARD_COSMIC_LAYER_IDS.map(id => byId.get(id)).filter((r): r is ClockRingData => r != null);
  }, [snapshot.rings]);

  return (
    <div className={["cp-dashboard-layout w-full min-h-0", className].join(" ")}>
      <section className="cp-dashboard-wheel-zone min-w-0" aria-label="Visual engine">
        <CosmicClockWheel snapshot={snapshot} showReadout={false} />
        <p className="cp-dashboard-wheel-hint" aria-hidden>
          Scroll for layer readouts
        </p>
      </section>

      <aside className="cp-dashboard-details-zone min-w-0" aria-label="Data readout">
        <div className="cp-dashboard-time-card rounded-xl border border-[var(--gold-dp)]/40 bg-[#0a0a0c]/98 backdrop-blur-md px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.22em] text-[var(--gold-dp)]">
            Standard Time
          </p>
          <p className="mt-1.5 text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-[var(--gold-lt)]">
            {digitalTime}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-dim)]">{hubTime}</p>
        </div>

        {cosmicLayers.map(ring => (
          <LayerReadoutCard key={ring.ringId} ring={ring} hubTime={hubTime} />
        ))}
      </aside>
    </div>
  );
}
