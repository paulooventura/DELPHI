"use client";

import { useMemo } from "react";
import { CosmicClockWheel } from "./CosmicClockWheel";
import { SpacetimeAnchor } from "./SpacetimeAnchor";
import { useRealtimeDate } from "../hooks/useRealtimeDate";
import type { CosmicClockState } from "../lib/cosmic";
import {
  calculateCosmicTime,
  dashboardLayerNumber,
  DASHBOARD_COSMIC_LAYER_IDS,
  formatHubClockTime,
  formatStandardDigitalTime,
  ringProvenanceNote,
  ringProvenanceTier,
  type ClockRingData,
} from "../lib/timeEngine";
import { COSMIC_ASSETS, ringAccentColor, segmentGraphicKey } from "../lib/cosmicAssets";
import { CosmicGraphicBadge } from "../lib/cosmicGraphicIcons";
import { useSpringScalar } from "../hooks/useSpringMotion";
import type { CycleReading } from "../lib/worldCycles";

export type DashboardContainerProps = {
  className?: string;
  lat: number;
  lon: number;
  cosmic?: CosmicClockState | null;
  /** Enabled Atlas calendar readings → outer clock rings + layer cards. */
  atlasReadings?: CycleReading[];
  liveCoords?: boolean;
  usingFallback?: boolean;
  locationDenied?: boolean;
  locationEnabled?: boolean;
  accuracyM?: number | null;
  altM?: number | null;
  altAccuracyM?: number | null;
  speedMps?: number | null;
  gpsHeading?: number | null;
  locationAtMs?: number | null;
  compassHeading?: number | null;
  compassOffsetDeg?: number;
  declinationDeg?: number;
  pitchDeg?: number | null;
  emfUt?: number | null;
};

const TIER_BADGE: Record<string, string> = {
  measured: "Measured",
  computed: "Computed",
  cultural: "Cultural",
};

function parseToneFromMetadata(metadata: string): number | null {
  const m = metadata.match(/Tone (\d+)/);
  return m ? Number(m[1]) : null;
}

function ProgressBar({ value, accent }: { value: number; accent: string }) {
  const smooth = useSpringScalar(value);
  const pct = Math.max(0, Math.min(100, smooth * 100));
  return (
    <div className="cp-layer-progress mt-2.5 h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="cp-layer-progress-fill h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${accent}55, ${accent}cc 72%, ${accent})`,
          boxShadow: `0 0 12px ${accent}66, 0 0 4px ${accent}99`,
        }}
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
  const tier = ringProvenanceTier(ring.ringId);
  const provenance = ringProvenanceNote(ring.ringId);
  const isKe = ring.ringId === 4;
  const isMayan = ring.ringId === 8;
  const tone = isMayan ? parseToneFromMetadata(ring.activeSegment.metadata) : null;

  return (
    <article
      className="cp-layer-readout-card group relative min-w-0 rounded-xl border border-white/[0.1] bg-[#0d1118]/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: accent, ["--layer-accent" as string]: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--gold-dp)]">
          Layer {layerNum}: {ring.name}
        </p>
        <span className={`cp-layer-tier cp-layer-tier-${tier}`} title={provenance}>
          {TIER_BADGE[tier]}
        </span>
      </div>

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
      {provenance && (
        <p className="mt-1.5 text-[0.58rem] text-[var(--ink-dim)]/80 italic">{provenance}</p>
      )}
    </article>
  );
}

export function DashboardContainer({
  className = "",
  lat,
  lon,
  cosmic = null,
  atlasReadings = [],
  liveCoords = false,
  usingFallback = false,
  locationDenied = false,
  locationEnabled = true,
  accuracyM = null,
  altM = null,
  altAccuracyM = null,
  speedMps = null,
  gpsHeading = null,
  locationAtMs = null,
  compassHeading = null,
  compassOffsetDeg = 0,
  declinationDeg = 0,
  pitchDeg = null,
  emfUt = null,
}: DashboardContainerProps) {
  const currentDate = useRealtimeDate();
  const snapshot = useMemo(
    () => calculateCosmicTime(currentDate, { atlasReadings }),
    [currentDate, atlasReadings],
  );
  const hubTime = formatHubClockTime(currentDate);
  const digitalTime = formatStandardDigitalTime(currentDate);

  const cosmicLayers = useMemo(() => {
    const byId = new Map(snapshot.rings.map(r => [r.ringId, r]));
    const core = DASHBOARD_COSMIC_LAYER_IDS.map(id => byId.get(id)).filter((r): r is ClockRingData => r != null);
    const atlas = snapshot.rings.filter(r => r.ringId >= 11);
    return [...core, ...atlas];
  }, [snapshot.rings]);

  return (
    <div className={["cp-dashboard-layout w-full min-h-0", className].join(" ")}>
      <section className="cp-dashboard-wheel-zone min-w-0" aria-label="Visual engine">
        <CosmicClockWheel snapshot={snapshot} showReadout={false} />
        <p className="cp-dashboard-wheel-hint" aria-hidden>
          Scroll for technical readout
        </p>
      </section>

      <aside className="cp-dashboard-details-zone min-w-0" aria-label="Data readout">
        <SpacetimeAnchor
          now={currentDate}
          lat={lat}
          lon={lon}
          snapshot={snapshot}
          cosmic={cosmic}
          liveCoords={liveCoords}
          locationEnabled={locationEnabled}
          locationDenied={locationDenied}
          accuracyM={accuracyM}
          altM={altM}
          altAccuracyM={altAccuracyM}
          speedMps={speedMps}
          gpsHeading={gpsHeading}
          locationAtMs={locationAtMs}
          compassHeading={compassHeading}
          compassOffsetDeg={compassOffsetDeg}
          declinationDeg={declinationDeg}
          pitchDeg={pitchDeg}
          emfUt={emfUt}
        />

        {usingFallback && locationEnabled && !locationDenied && (
          <div className="cp-fix-banner" role="status">
            Using approximate coordinates — enable location for your true sky and cycles.
          </div>
        )}
        {locationDenied && locationEnabled && (
          <div className="cp-fix-banner cp-fix-banner-warn" role="status">
            Location blocked — allow browser access to anchor this moment to your place on Earth.
          </div>
        )}
        <div className="cp-dashboard-time-card rounded-xl border border-[var(--gold-dp)]/40 bg-[#0a0a0c]/92 backdrop-blur-md px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.22em] text-[var(--gold-dp)]">
            Standard Time
          </p>
          <p className="cp-dashboard-digital-time mt-1.5 text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-[var(--gold-lt)]">
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
