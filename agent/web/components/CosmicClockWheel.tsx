"use client";

import { useId, useMemo, type ReactElement } from "react";
import type { ClockRingData, CosmicTimeSnapshot } from "../lib/timeEngine";
import { OBS } from "../lib/design/observatoryTokens";

export type CosmicClockWheelProps = {
  snapshot: CosmicTimeSnapshot;
  className?: string;
  /** When false, hides the built-in bottom segment grid (use DashboardContainer readout). */
  showReadout?: boolean;
};

/** D3-scale linear map (domain → range). */
function scaleLinear(
  domain: [number, number],
  range: [number, number],
): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return v => r0 + ((v - d0) / span) * (r1 - r0);
}

const CX = 400;
const CY = 420;
const INNER_R = 100;
const OUTER_R = 400;
const RING_COUNT = 7;

export const COSMIC_CLOCK_OUTER_RADIUS = OUTER_R;

const RING_STYLE: Record<
  number,
  { divisions: number; labelEvery: number; color: string; shortName: string }
> = {
  1: { divisions: 100, labelEvery: 25, color: "#fbbf24", shortName: "Kè" },
  2: { divisions: 12, labelEvery: 1, color: "#f97316", shortName: "Shí" },
  3: { divisions: 8, labelEvery: 1, color: "#94a3b8", shortName: "Moon" },
  4: { divisions: 24, labelEvery: 6, color: "#22d3ee", shortName: "Sun" },
  5: { divisions: 20, labelEvery: 5, color: "#7c3aed", shortName: "Tzolk'in" },
  6: { divisions: 12, labelEvery: 1, color: "#e879f9", shortName: "Zodiac" },
  7: { divisions: 60, labelEvery: 15, color: "#dc2626", shortName: "60-yr" },
};

function ringRadii(index: number): { inner: number; outer: number; mid: number } {
  const band = (OUTER_R - INNER_R) / RING_COUNT;
  const inner = INNER_R + index * band;
  const outer = INNER_R + (index + 1) * band;
  return { inner, outer, mid: (inner + outer) / 2 };
}

/** Fractional position around full cycle (0–1) for dial rotation. */
function cycleFraction(ring: ClockRingData): number {
  const { ringId, normalizedProgress, activeSegment } = ring;
  const v = activeSegment.numericalValue;
  switch (ringId) {
    case 1:
      return (v + normalizedProgress) / 100;
    case 2:
      return (v + normalizedProgress) / 12;
    case 3:
      return normalizedProgress;
    case 4:
      return normalizedProgress;
    case 5:
      return (v + normalizedProgress) / 20;
    case 6:
      return (v + normalizedProgress) / 12;
    case 7:
      return normalizedProgress;
    default:
      return normalizedProgress;
  }
}

function tickAngle(index: number, divisions: number): number {
  return ((index / divisions) * 360 - 90) * (Math.PI / 180);
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

function CosmicRing({
  ring,
  index,
  uid,
}: {
  ring: ClockRingData;
  index: number;
  uid: string;
}) {
  const style = RING_STYLE[ring.ringId] ?? RING_STYLE[1]!;
  const { inner, outer, mid } = ringRadii(index);
  const band = outer - inner;
  const dialSpin = -cycleFraction(ring) * 360;
  const labelScale = scaleLinear([INNER_R, OUTER_R], [5, 8]);

  const ticks: ReactElement[] = [];
  const labels: ReactElement[] = [];

  for (let i = 0; i <= style.divisions; i++) {
    const ang = tickAngle(i, style.divisions);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const major = i % style.labelEvery === 0;
    ticks.push(
      <line
        key={`t${i}`}
        x1={CX + cos * inner}
        y1={CY + sin * inner}
        x2={CX + cos * (outer - 1)}
        y2={CY + sin * (outer - 1)}
        stroke={major ? style.color : OBS.vector.structural}
        strokeWidth={major ? 1 : 0.6}
        strokeLinecap="round"
        opacity={major ? 0.85 : 0.35}
      />,
    );
  }

  for (let i = 0; i < style.divisions; i++) {
    if (i % style.labelEvery !== 0) continue;
    const ang = tickAngle(i + 0.5, style.divisions);
    const sin = Math.sin(ang);
    if (sin > -0.08) continue;

    const cos = Math.cos(ang);
    const lx = CX + cos * mid;
    const ly = CY + sin * mid;
    const rot = (ang * 180) / Math.PI + 90;
    const fs = labelScale(mid);

    let txt = String(i);
    if (ring.ringId === 2) {
      const animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
      txt = animals[i] ?? txt;
    } else if (ring.ringId === 3) {
      txt = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"][i] ?? "·";
    } else if (ring.ringId === 6) {
      txt = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"][i] ?? "·";
    }

    labels.push(
      <text
        key={`l${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fs}
        fill={OBS.day.ink}
        fontFamily={OBS.typography.micro}
        fontWeight={600}
        transform={`rotate(${rot}, ${lx}, ${ly})`}
      >
        {txt}
      </text>,
    );
  }

  return (
    <g className="cosmic-ring" transform={`rotate(${dialSpin} ${CX} ${CY})`}>
      <defs>
        <linearGradient id={`cosmic-ring-${uid}-${ring.ringId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={style.color} stopOpacity={0.55} />
          <stop offset="100%" stopColor={OBS.space.core} stopOpacity={0.9} />
        </linearGradient>
        <clipPath id={`cosmic-clip-${uid}-${ring.ringId}`}>
          <path d={semicircleAnnulusPath(CX, CY, outer, inner)} />
        </clipPath>
      </defs>

      <path
        d={semicircleAnnulusPath(CX, CY, outer, inner)}
        fill={`url(#cosmic-ring-${uid}-${ring.ringId})`}
        stroke={style.color}
        strokeWidth={0.6}
        strokeOpacity={0.45}
      />

      <g clipPath={`url(#cosmic-clip-${uid}-${ring.ringId})`}>
        {ticks}
        {labels}
      </g>

      <text
        x={CX}
        y={CY - mid}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={Math.max(5, Math.min(band * 0.38, 9))}
        fill={style.color}
        fontFamily={OBS.typography.micro}
        fontWeight={700}
        pointerEvents="none"
      >
        {ring.activeSegment.symbol}
      </text>
    </g>
  );
}

export function CosmicClockWheel({ snapshot, className = "", showReadout = true }: CosmicClockWheelProps) {
  const uid = useId().replace(/:/g, "");
  const rings = useMemo(
    () => [...snapshot.rings].sort((a, b) => a.ringId - b.ringId),
    [snapshot.rings],
  );

  const playheadTop = CY - OUTER_R - 16;

  return (
    <div
      className={[
        "relative w-full max-w-[820px] mx-auto overflow-hidden",
        "rounded-2xl border border-white/10 bg-[var(--void)] shadow-[0_12px_48px_rgba(0,0,0,0.45)]",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 800 440"
        className="block w-full h-auto aspect-[800/440] select-none"
        role="img"
        aria-label="Cosmic clock semi-circle wheel"
      >
        <defs>
          <radialGradient id={`cosmic-bg-${uid}`} cx="50%" cy="100%" r="75%">
            <stop offset="0%" stopColor="#121a28" />
            <stop offset="55%" stopColor={OBS.space.core} />
            <stop offset="100%" stopColor={OBS.space.outer} />
          </radialGradient>
          <clipPath id={`cosmic-dome-${uid}`}>
            <rect x={0} y={0} width={800} height={CY} />
          </clipPath>
          <filter id={`cosmic-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={0} y={0} width={800} height={440} fill={`url(#cosmic-bg-${uid})`} />

        <g clipPath={`url(#cosmic-dome-${uid})`}>
          {rings.map((ring, index) => (
            <CosmicRing key={ring.ringId} ring={ring} index={index} uid={uid} />
          ))}
        </g>

        {/* NOW alignment playhead — fixed at 12 o'clock dome apex */}
        <g className="cosmic-playhead" filter={`url(#cosmic-glow-${uid})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={playheadTop}
            stroke="var(--gold-lt)"
            strokeWidth={2.25}
            strokeLinecap="round"
          />
          <polygon
            points={`${CX},${playheadTop - 6} ${CX + 5},${playheadTop + 2} ${CX - 5},${playheadTop + 2}`}
            fill="var(--gold-lt)"
          />
          <text
            x={CX}
            y={playheadTop - 12}
            textAnchor="middle"
            fontSize={9}
            fill="var(--gold-lt)"
            fontFamily={OBS.typography.micro}
            fontWeight={700}
            letterSpacing="0.14em"
          >
            NOW
          </text>
          <text
            x={CX}
            y={playheadTop - 2}
            textAnchor="middle"
            fontSize={6}
            fill="rgba(245, 215, 142, 0.72)"
            fontFamily={OBS.typography.micro}
            letterSpacing="0.06em"
          >
            alignment playhead
          </text>
        </g>

        {/* Hub — active inner cycle */}
        <circle cx={CX} cy={CY} r={INNER_R - 8} fill="rgba(5, 7, 11, 0.92)" stroke="var(--gold-dp)" strokeWidth={1} />
        <text
          x={CX}
          y={CY - 10}
          textAnchor="middle"
          fontSize={8}
          fill="var(--gold-lt)"
          fontFamily={OBS.typography.micro}
          fontWeight={700}
        >
          {rings[0]?.activeSegment.symbol}
        </text>
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          fontSize={6.5}
          fill={OBS.day.ink}
          fontFamily={OBS.typography.micro}
        >
          {rings[0]?.activeSegment.name}
        </text>
        <text
          x={CX}
          y={CY + 16}
          textAnchor="middle"
          fontSize={5.5}
          fill="rgba(226, 232, 240, 0.55)"
          fontFamily={OBS.typography.micro}
        >
          {Math.round((rings[0]?.normalizedProgress ?? 0) * 100)}%
        </text>

        {/* Ring legend — outer labels without overlapping dial */}
        <g className="cosmic-legend">
          {rings.map((ring, index) => {
            const { outer } = ringRadii(index);
            const y = CY - outer + 10;
            return (
              <text
                key={`leg-${ring.ringId}`}
                x={CX + outer - 6}
                y={y}
                textAnchor="end"
                fontSize={5}
                fill={RING_STYLE[ring.ringId]?.color ?? OBS.day.ink}
                fontFamily={OBS.typography.micro}
                opacity={0.85}
              >
                {RING_STYLE[ring.ringId]?.shortName}
              </text>
            );
          })}
        </g>
      </svg>

      {showReadout && (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 px-3 pb-3 pt-1 border-t border-white/5">
        {rings.map(ring => (
          <div
            key={ring.ringId}
            className="min-w-0 rounded-lg bg-white/[0.03] px-2 py-1.5 border border-white/[0.06]"
          >
            <p className="text-[0.5rem] uppercase tracking-wider text-[var(--gold-dp)] truncate">
              {ring.name}
            </p>
            <p className="text-[0.65rem] font-semibold text-[var(--ink)] truncate flex items-center gap-1">
              <span>{ring.activeSegment.symbol}</span>
              <span className="truncate">{ring.activeSegment.name}</span>
            </p>
            <p className="text-[0.5rem] text-[var(--ink-dim)] tabular-nums">
              {(ring.normalizedProgress * 100).toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
