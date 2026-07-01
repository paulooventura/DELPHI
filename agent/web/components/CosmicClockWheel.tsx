"use client";

import { useId, useMemo, type CSSProperties } from "react";
import type { ClockRingData, CosmicTimeSnapshot } from "../lib/timeEngine";
import {
  formatHubClockTime,
  ringCycleFraction,
  WHEEL_VISIBLE_RING_IDS,
} from "../lib/timeEngine";
import { OBS } from "../lib/design/observatoryTokens";
import { ringAccentColor, ringSegmentVisual } from "../lib/cosmicAssets";

export type CosmicClockWheelProps = {
  snapshot: CosmicTimeSnapshot;
  className?: string;
  showReadout?: boolean;
};

const CX = 400;
const CY = 430;
const HUB_R = 36;
const INNER_R = 68;
const OUTER_R = 400;

export const COSMIC_CLOCK_OUTER_RADIUS = OUTER_R;

const WHEEL_RING_CONFIG: Record<
  number,
  { divisions: number; labelEvery: number; shortName: string }
> = {
  4: { divisions: 100, labelEvery: 10, shortName: "Kè" },
  5: { divisions: 12, labelEvery: 1, shortName: "Shí" },
  6: { divisions: 8, labelEvery: 1, shortName: "Moon" },
  7: { divisions: 4, labelEvery: 1, shortName: "Season" },
  8: { divisions: 20, labelEvery: 1, shortName: "Tzolk'in" },
  9: { divisions: 12, labelEvery: 1, shortName: "Zodiac" },
  10: { divisions: 12, labelEvery: 1, shortName: "60-yr" },
};

function ringRadii(wheelIndex: number, wheelCount: number): { inner: number; outer: number; mid: number } {
  const band = (OUTER_R - INNER_R) / wheelCount;
  const inner = INNER_R + wheelIndex * band;
  const outer = INNER_R + (wheelIndex + 1) * band;
  return { inner, outer, mid: (inner + outer) / 2 };
}

function tickAngle(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

function semicircleAnnulusPath(cx: number, cy: number, outer: number, inner: number): string {
  return [
    `M ${cx - outer} ${cy}`,
    `A ${outer} ${outer} 0 0 1 ${cx + outer} ${cy}`,
    `L ${cx + inner} ${cy}`,
    `A ${inner} ${inner} 0 0 0 ${cx - inner} ${cy}`,
    "Z",
  ].join(" ");
}

function donutSectorPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  startDeg: number,
  endDeg: number,
): string {
  const a0 = tickAngle(startDeg);
  const a1 = tickAngle(endDeg);
  const x0o = cx + Math.cos(a0) * outer;
  const y0o = cy + Math.sin(a0) * outer;
  const x1o = cx + Math.cos(a1) * outer;
  const y1o = cy + Math.sin(a1) * outer;
  const x1i = cx + Math.cos(a1) * inner;
  const y1i = cy + Math.sin(a1) * inner;
  const x0i = cx + Math.cos(a0) * inner;
  const y0i = cy + Math.sin(a0) * inner;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${outer} ${outer} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${inner} ${inner} 0 ${large} 0 ${x0i} ${y0i}`,
    "Z",
  ].join(" ");
}

function PlayheadSlot({ inner, outer }: { inner: number; outer: number }) {
  return (
    <path
      d={donutSectorPath(CX, CY, inner, outer, -10, 10)}
      fill="var(--gold-lt)"
      fillOpacity={0.22}
      stroke="var(--gold-lt)"
      strokeWidth={1.2}
      strokeOpacity={0.85}
      pointerEvents="none"
    />
  );
}

function CosmicSegmentRing({
  ring,
  wheelIndex,
  uid,
  wheelCount,
}: {
  ring: ClockRingData;
  wheelIndex: number;
  uid: string;
  wheelCount: number;
}) {
  const cfg = WHEEL_RING_CONFIG[ring.ringId] ?? WHEEL_RING_CONFIG[4]!;
  const { inner, outer, mid } = ringRadii(wheelIndex, wheelCount);
  const band = outer - inner;
  const dialSpin = -ringCycleFraction(ring) * 360;
  const accent = ringAccentColor(ring.ringId);
  const activeIdx = Math.floor(ringCycleFraction(ring) * cfg.divisions) % cfg.divisions;

  const spinStyle: CSSProperties = {
    transform: `rotate(${dialSpin}deg)`,
    transformOrigin: `${CX}px ${CY}px`,
    transition: "transform 0.15s linear",
  };

  const segments = [];
  for (let i = 0; i < cfg.divisions; i++) {
    const start = (i / cfg.divisions) * 360;
    const end = ((i + 1) / cfg.divisions) * 360;
    const vis = ringSegmentVisual(ring.ringId, i, cfg.divisions);
    const isActive = i === activeIdx;
    const ang = tickAngle(start + (end - start) / 2);
    const sin = Math.sin(ang);
    const showLabel = sin < -0.12 && (i % cfg.labelEvery === 0 || vis.label.length <= 2);

    segments.push(
      <g key={i}>
        <path
          d={donutSectorPath(CX, CY, inner + 0.5, outer - 0.5, start, end)}
          fill={vis.fill}
          stroke={isActive ? "var(--gold-lt)" : vis.stroke}
          strokeWidth={isActive ? 1.1 : 0.45}
          strokeOpacity={isActive ? 0.95 : 0.65}
        />
        {showLabel && vis.label && (
          <text
            x={CX + Math.cos(ang) * mid}
            y={CY + Math.sin(ang) * mid}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(5, Math.min(band * 0.42, ring.ringId === 5 ? 9 : 7))}
            fill={isActive ? "var(--gold-lt)" : OBS.day.ink}
            fontFamily={OBS.typography.micro}
            fontWeight={isActive ? 700 : 500}
            transform={`rotate(${(ang * 180) / Math.PI + 90}, ${CX + Math.cos(ang) * mid}, ${CY + Math.sin(ang) * mid})`}
          >
            {vis.label}
          </text>
        )}
      </g>,
    );
  }

  return (
    <g className="cosmic-segment-ring">
      <g style={spinStyle} clipPath={`url(#cosmic-clip-${uid}-${ring.ringId})`}>
        {segments}
      </g>
      <defs>
        <clipPath id={`cosmic-clip-${uid}-${ring.ringId}`}>
          <path d={semicircleAnnulusPath(CX, CY, outer, inner)} />
        </clipPath>
      </defs>
      <path
        d={semicircleAnnulusPath(CX, CY, outer, inner)}
        fill="none"
        stroke={accent}
        strokeWidth={0.75}
        strokeOpacity={0.55}
        pointerEvents="none"
      />
      <PlayheadSlot inner={inner} outer={outer} />
    </g>
  );
}

export function CosmicClockWheel({ snapshot, className = "", showReadout = false }: CosmicClockWheelProps) {
  const uid = useId().replace(/:/g, "");
  const wheelRings = useMemo(() => {
    const byId = new Map(snapshot.rings.map(r => [r.ringId, r]));
    return WHEEL_VISIBLE_RING_IDS.map(id => byId.get(id)).filter((r): r is ClockRingData => r != null);
  }, [snapshot.rings]);

  const wheelCount = wheelRings.length;
  const playheadTop = CY - OUTER_R - 12;
  const hubTime = formatHubClockTime(snapshot.date);

  return (
    <div
      className={[
        "relative w-full max-w-[900px] mx-auto overflow-hidden",
        "rounded-2xl border border-[var(--gold-dp)]/20 bg-[#0a0a0c]",
        "shadow-[0_16px_56px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(201,162,39,0.08)]",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 800 450"
        className="block w-full h-auto aspect-[800/450] select-none"
        role="img"
        aria-label="Cosmic clock semi-circle wheel"
      >
        <defs>
          <radialGradient id={`cosmic-bg-${uid}`} cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="#1a1510" />
            <stop offset="45%" stopColor="#0D111A" />
            <stop offset="100%" stopColor="#05070B" />
          </radialGradient>
          <clipPath id={`cosmic-dome-${uid}`}>
            <rect x={0} y={0} width={800} height={CY} />
          </clipPath>
          <filter id={`cosmic-glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={0} y={0} width={800} height={450} fill={`url(#cosmic-bg-${uid})`} />

        <g clipPath={`url(#cosmic-dome-${uid})`}>
          {wheelRings.map((ring, index) => (
            <CosmicSegmentRing
              key={ring.ringId}
              ring={ring}
              wheelIndex={index}
              uid={uid}
              wheelCount={wheelCount}
            />
          ))}
        </g>

        <g className="cosmic-playhead" filter={`url(#cosmic-glow-${uid})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={playheadTop}
            stroke="var(--gold-lt)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <polygon
            points={`${CX},${playheadTop - 7} ${CX + 6},${playheadTop + 2} ${CX - 6},${playheadTop + 2}`}
            fill="var(--gold-lt)"
          />
          <text
            x={CX}
            y={playheadTop - 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--gold-lt)"
            fontFamily={OBS.typography.micro}
            fontWeight={700}
            letterSpacing="0.2em"
          >
            NOW
          </text>
        </g>

        <path
          d={`M ${CX - HUB_R - 8} ${CY} A ${HUB_R + 8} ${HUB_R + 8} 0 0 1 ${CX + HUB_R + 8} ${CY} Z`}
          fill="#05070B"
          stroke="var(--gold-dp)"
          strokeWidth={1.25}
        />
        <text
          x={CX}
          y={CY - 10}
          textAnchor="middle"
          fontSize={8}
          fill="var(--gold-dp)"
          fontFamily={OBS.typography.micro}
          fontWeight={600}
          letterSpacing="0.08em"
        >
          NOW
        </text>
        <text
          x={CX}
          y={CY + 6}
          textAnchor="middle"
          fontSize={9}
          fill="var(--gold-lt)"
          fontFamily={OBS.typography.micro}
          fontWeight={700}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {hubTime.replace(/^NOW\s/, "")}
        </text>
      </svg>

      {showReadout && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-3 pb-3 pt-1 border-t border-white/5">
          {wheelRings.map(ring => (
            <div key={ring.ringId} className="min-w-0 rounded-lg bg-white/[0.03] px-2 py-1.5 border border-white/[0.06]">
              <p className="text-[0.5rem] uppercase tracking-wider text-[var(--gold-dp)] truncate">{ring.name}</p>
              <p className="text-[0.65rem] font-semibold text-[var(--ink)] truncate">
                {ring.activeSegment.symbol} {ring.activeSegment.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
