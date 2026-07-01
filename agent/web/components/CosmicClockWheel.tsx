"use client";

import { useId, useMemo, type ReactElement, type CSSProperties } from "react";
import type { ClockRingData, CosmicTimeSnapshot } from "../lib/timeEngine";
import { COSMIC_RING_COUNT, formatStandardDigitalTime, ringCycleFraction } from "../lib/timeEngine";
import { OBS } from "../lib/design/observatoryTokens";
import { COSMIC_ASSETS, ringAccentColor } from "../lib/cosmicAssets";

export type CosmicClockWheelProps = {
  snapshot: CosmicTimeSnapshot;
  className?: string;
  showReadout?: boolean;
};

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
const HUB_R = 28;
const INNER_R = 55;
const OUTER_R = 400;

export const COSMIC_CLOCK_OUTER_RADIUS = OUTER_R;

const SEASON_QUADRANT_COLORS = COSMIC_ASSETS.solar.quadrantColors();
const SEASON_QUADRANT_LABELS = COSMIC_ASSETS.solar.quadrantSymbols();

const RING_STYLE: Record<
  number,
  {
    divisions: number;
    labelEvery: number;
    color: string;
    shortName: string;
    smooth?: boolean;
    clockStyle?: boolean;
  }
> = {
  1: { divisions: 60, labelEvery: 15, color: ringAccentColor(1), shortName: "Sec", smooth: true, clockStyle: true },
  2: { divisions: 60, labelEvery: 10, color: ringAccentColor(2), shortName: "Min", clockStyle: true },
  3: { divisions: 24, labelEvery: 3, color: ringAccentColor(3), shortName: "Hr", clockStyle: true },
  4: { divisions: 100, labelEvery: 25, color: ringAccentColor(4), shortName: "Kè" },
  5: { divisions: 12, labelEvery: 1, color: ringAccentColor(5), shortName: "Shí" },
  6: { divisions: 8, labelEvery: 1, color: ringAccentColor(6), shortName: "Moon" },
  7: { divisions: 4, labelEvery: 1, color: ringAccentColor(7), shortName: "Season" },
  8: { divisions: 20, labelEvery: 5, color: ringAccentColor(8), shortName: "Tzolk'in" },
  9: { divisions: 12, labelEvery: 1, color: ringAccentColor(9), shortName: "Zodiac" },
  10: { divisions: 60, labelEvery: 15, color: ringAccentColor(10), shortName: "60-yr" },
};

function ringRadii(index: number, ringCount: number): { inner: number; outer: number; mid: number } {
  const band = (OUTER_R - INNER_R) / ringCount;
  const inner = INNER_R + index * band;
  const outer = INNER_R + (index + 1) * band;
  return { inner, outer, mid: (inner + outer) / 2 };
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

function donutSectorPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const a0 = toRad(startDeg);
  const a1 = toRad(endDeg);
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

function SeasonQuadrants({ inner, outer }: { inner: number; outer: number }) {
  return (
    <>
      {SEASON_QUADRANT_COLORS.map((color, q) => (
        <path
          key={q}
          d={donutSectorPath(CX, CY, inner, outer, q * 90, (q + 1) * 90)}
          fill={color}
          fillOpacity={0.35}
          stroke={color}
          strokeWidth={0.5}
          strokeOpacity={0.55}
        />
      ))}
      {SEASON_QUADRANT_LABELS.map((label, q) => {
        const ang = tickAngle(q * 90 + 45, 360);
        const lx = CX + Math.cos(ang) * ((inner + outer) / 2);
        const ly = CY + Math.sin(ang) * ((inner + outer) / 2);
        return (
          <text
            key={`sq${q}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(6, (outer - inner) * 0.35)}
          >
            {label}
          </text>
        );
      })}
    </>
  );
}

function ringSpinStyle(ring: ClockRingData, dialSpin: number): CSSProperties {
  const style = RING_STYLE[ring.ringId];
  return {
    transform: `rotate(${dialSpin}deg)`,
    transformOrigin: `${CX}px ${CY}px`,
    transformBox: "fill-box" as CSSProperties["transformBox"],
    transition: style?.smooth
      ? "transform 0.06s linear"
      : style?.clockStyle
        ? "transform 0.12s linear"
        : "transform 0.2s ease-out",
  };
}

function CosmicRing({
  ring,
  index,
  uid,
  ringCount,
}: {
  ring: ClockRingData;
  index: number;
  uid: string;
  ringCount: number;
}) {
  const style = RING_STYLE[ring.ringId] ?? RING_STYLE[1]!;
  const { inner, outer, mid } = ringRadii(index, ringCount);
  const band = outer - inner;
  const dialSpin = -ringCycleFraction(ring) * 360;
  const labelScale = scaleLinear([INNER_R, OUTER_R], [4.5, 8]);

  const ticks: ReactElement[] = [];
  const labels: ReactElement[] = [];

  for (let i = 0; i <= style.divisions; i++) {
    const ang = tickAngle(i, style.divisions);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const major = i % style.labelEvery === 0;
    const isClock = style.clockStyle;
    ticks.push(
      <line
        key={`t${i}`}
        x1={CX + cos * inner}
        y1={CY + sin * inner}
        x2={CX + cos * (outer - (isClock && major ? 2 : 1))}
        y2={CY + sin * (outer - (isClock && major ? 2 : 1))}
        stroke={major ? style.color : OBS.vector.structural}
        strokeWidth={major ? (isClock ? 1.2 : 1) : 0.55}
        strokeLinecap="round"
        opacity={major ? 0.9 : 0.35}
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
    if (ring.ringId === 1) txt = String(i);
    else if (ring.ringId === 2) txt = String(i).padStart(2, "0");
    else if (ring.ringId === 3) txt = String(i);
    else if (ring.ringId === 5) {
      txt = COSMIC_ASSETS.chinese.shi.animals[i]?.glyph ?? txt;
    } else if (ring.ringId === 6) {
      txt = COSMIC_ASSETS.lunar.symbols()[i] ?? "·";
    } else if (ring.ringId === 7) {
      txt = SEASON_QUADRANT_LABELS[i] ?? "·";
    } else if (ring.ringId === 9) {
      txt = COSMIC_ASSETS.zodiac.glyphs()[i] ?? "·";
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
        fontWeight={style.clockStyle ? 700 : 600}
        style={{ fontVariantNumeric: "tabular-nums" }}
        transform={`rotate(${rot}, ${lx}, ${ly})`}
      >
        {txt}
      </text>,
    );
  }

  return (
    <g className="cosmic-ring" style={ringSpinStyle(ring, dialSpin)}>
      <defs>
        <linearGradient id={`cosmic-ring-${uid}-${ring.ringId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={style.color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={OBS.space.core} stopOpacity={0.92} />
        </linearGradient>
        <clipPath id={`cosmic-clip-${uid}-${ring.ringId}`}>
          <path d={semicircleAnnulusPath(CX, CY, outer, inner)} />
        </clipPath>
      </defs>

      {ring.ringId === 7 && <SeasonQuadrants inner={inner} outer={outer} />}

      <path
        d={semicircleAnnulusPath(CX, CY, outer, inner)}
        fill={ring.ringId === 7 ? "none" : `url(#cosmic-ring-${uid}-${ring.ringId})`}
        stroke={style.color}
        strokeWidth={0.65}
        strokeOpacity={0.5}
      />

      <g clipPath={`url(#cosmic-clip-${uid}-${ring.ringId})`}>
        {ticks}
        {labels}
      </g>

      {ring.ringId === 1 && (
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - mid}
          stroke={style.color}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.95}
        />
      )}
    </g>
  );
}

export function CosmicClockWheel({ snapshot, className = "", showReadout = true }: CosmicClockWheelProps) {
  const uid = useId().replace(/:/g, "");
  const ringCount = snapshot.rings.length || COSMIC_RING_COUNT;
  const rings = useMemo(
    () => [...snapshot.rings].sort((a, b) => a.ringId - b.ringId),
    [snapshot.rings],
  );

  const playheadTop = CY - OUTER_R - 16;
  const digitalTime = formatStandardDigitalTime(snapshot.date);
  const secondsRing = rings.find(r => r.ringId === 1);
  const secondsSpin = secondsRing ? -ringCycleFraction(secondsRing) * 360 : 0;

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
            <CosmicRing key={ring.ringId} ring={ring} index={index} uid={uid} ringCount={ringCount} />
          ))}
        </g>

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

        <circle cx={CX} cy={CY} r={HUB_R} fill="rgba(5, 7, 11, 0.95)" stroke="var(--gold-dp)" strokeWidth={1.2} />
        <g
          style={{
            transform: `rotate(${secondsSpin}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: "transform 0.06s linear",
          }}
        >
          <circle cx={CX} cy={CY - HUB_R + 6} r={2.5} fill="#fbbf24" />
        </g>
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          fontSize={7}
          fill="var(--gold-lt)"
          fontFamily={OBS.typography.micro}
          fontWeight={700}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {digitalTime}
        </text>

        <g className="cosmic-legend">
          {rings.map((ring, index) => {
            const { outer } = ringRadii(index, ringCount);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 px-3 pb-3 pt-1 border-t border-white/5">
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
