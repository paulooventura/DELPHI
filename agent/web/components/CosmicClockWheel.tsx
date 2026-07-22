"use client";

import { useId, useMemo, useEffect, useState } from "react";
import type { ClockRingData, CosmicTimeSnapshot } from "../lib/timeEngine";
import {
  formatHubCivilDate,
  formatHubTime24,
  WHEEL_ATLAS_RING_CAP,
  WHEEL_VISIBLE_RING_IDS,
} from "../lib/timeEngine";
import { OBS } from "../lib/design/observatoryTokens";
import { ringAccentColor, ringSegmentVisual } from "../lib/cosmicAssets";
import { CosmicGraphicIcon } from "../lib/cosmicGraphicIcons";
import { useRingFractionSprings } from "../hooks/useSpringMotion";

export type ClockWeatherTell = {
  emoji?: string;
  condition?: string;
  tempC?: number | null;
};

export type CosmicClockWheelProps = {
  snapshot: CosmicTimeSnapshot;
  className?: string;
  showReadout?: boolean;
  /** Current weather telltale for the hub (optional). */
  weather?: ClockWeatherTell | null;
  /** Overlay enabled Atlas calendars on the outer wheel (capped). */
  showAtlasRings?: boolean;
};

const CX = 400;
const CY = 430;
const HUB_R = 54;
const INNER_R = 78;
const OUTER_R = 400;

export const COSMIC_CLOCK_OUTER_RADIUS = OUTER_R;

const WHEEL_RING_CONFIG: Record<
  number,
  { divisions: number; shortName: string }
> = {
  1: { divisions: 60, shortName: "Seconds" },
  2: { divisions: 60, shortName: "Minutes" },
  3: { divisions: 24, shortName: "Hours" },
  4: { divisions: 100, shortName: "Kè" },
  5: { divisions: 12, shortName: "Dual-hr" },
  6: { divisions: 8, shortName: "Moon" },
  7: { divisions: 4, shortName: "Season" },
  8: { divisions: 20, shortName: "Kin" },
  9: { divisions: 12, shortName: "Zodiac" },
  10: { divisions: 12, shortName: "60-yr" },
};

function atlasShortName(name: string): string {
  const clean = name.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const first = clean.split(/[\s·—–-]+/)[0] ?? "Atlas";
  return first.slice(0, 9);
}

function ringShortName(ring: ClockRingData): string {
  if (ring.ringId >= 11) return atlasShortName(ring.name);
  return WHEEL_RING_CONFIG[ring.ringId]?.shortName ?? ring.name.slice(0, 8);
}

/** Compact value a stranger can read next to the ring label. */
function ringNowHint(ring: ClockRingData, date: Date): string {
  switch (ring.ringId) {
    case 1:
      return String(date.getSeconds()).padStart(2, "0");
    case 2:
      return String(date.getMinutes()).padStart(2, "0");
    case 3:
      return String(date.getHours()).padStart(2, "0");
    case 6: {
      const parts = ring.activeSegment.name.split(/\s+/);
      return parts[0] ?? ring.activeSegment.symbol;
    }
    case 7:
      return `Day ${date.getDate()}`;
    case 8:
      return ring.activeSegment.name.split(/\s+/)[0] ?? "Kin";
    case 9:
      return ring.activeSegment.name.split(/[·(]/)[0]?.trim().slice(0, 6) ?? ring.activeSegment.symbol;
    default:
      if (ring.ringId >= 11) {
        return ring.activeSegment.name.split(/[·,]/)[0]?.trim().slice(0, 10) ?? ring.activeSegment.symbol;
      }
      return ring.activeSegment.symbol;
  }
}

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

function gearTeethPath(cx: number, cy: number, radius: number, count: number, depth: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = tickAngle((i / count) * 360);
    const a1 = tickAngle(((i + 0.55) / count) * 360);
    const a2 = tickAngle(((i + 1) / count) * 360);
    const x0 = cx + Math.cos(a0) * radius;
    const y0 = cy + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * (radius + depth);
    const y1 = cy + Math.sin(a1) * (radius + depth);
    const x2 = cx + Math.cos(a2) * radius;
    const y2 = cy + Math.sin(a2) * radius;
    parts.push(`${i === 0 ? "M" : "L"} ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2}`);
  }
  return parts.join(" ") + " Z";
}

/** Rim teeth only — closed tooth polygons, never a filled disk that covers inner rings. */
function rimGearTeeth(
  cx: number,
  cy: number,
  radius: number,
  count: number,
  depth: number,
): { d: string; key: number }[] {
  const teeth: { d: string; key: number }[] = [];
  for (let i = 0; i < count; i++) {
    const mid = (i / count) * 360;
    // Upper semicircle only (matches the dome clip)
    const ang = ((mid % 360) + 360) % 360;
    if (ang > 95 && ang < 265) continue;
    const a0 = tickAngle(mid - 180 / count);
    const a1 = tickAngle(mid);
    const a2 = tickAngle(mid + 180 / count);
    const rIn = radius - 0.4;
    const rOut = radius + depth;
    const d = [
      `M ${cx + Math.cos(a0) * rIn} ${cy + Math.sin(a0) * rIn}`,
      `L ${cx + Math.cos(a0) * rOut} ${cy + Math.sin(a0) * rOut}`,
      `L ${cx + Math.cos(a1) * (rOut + depth * 0.15)} ${cy + Math.sin(a1) * (rOut + depth * 0.15)}`,
      `L ${cx + Math.cos(a2) * rOut} ${cy + Math.sin(a2) * rOut}`,
      `L ${cx + Math.cos(a2) * rIn} ${cy + Math.sin(a2) * rIn}`,
      "Z",
    ].join(" ");
    teeth.push({ d, key: i });
  }
  return teeth;
}

function PlayheadSlot({ inner, outer }: { inner: number; outer: number }) {
  return (
    <g className="cp-steampunk-playhead-slot">
      <path
        d={donutSectorPath(CX, CY, inner, outer, -16, 16)}
        fill="url(#cp-steam-pawl-fill)"
        stroke="#e8c86a"
        strokeWidth={1.6}
        strokeOpacity={0.85}
        pointerEvents="none"
      />
    </g>
  );
}

/** Slot offset from the playhead, wrapped into (-N/2, N/2]. */
function slotOffsetFromPlayhead(index: number, cycleFraction: number, divisions: number): number {
  const raw = index - cycleFraction * divisions;
  let d = ((raw % divisions) + divisions) % divisions;
  if (d > divisions / 2) d -= divisions;
  return d;
}

/**
 * Lay out every cycle member across the visible semicircle (−90°…+90°),
 * with the current value locked under the NOW playhead at the top (0°).
 * Marks near the playhead are bright/zoomed; outer marks fade away.
 */
function CosmicSegmentRing({
  ring,
  wheelIndex,
  uid,
  wheelCount,
  cycleFraction,
  nowHint,
}: {
  ring: ClockRingData;
  wheelIndex: number;
  uid: string;
  wheelCount: number;
  cycleFraction: number;
  nowHint: string;
}) {
  const cfg = WHEEL_RING_CONFIG[ring.ringId] ?? { divisions: 12, shortName: ringShortName(ring) };
  const shortName = ringShortName(ring);
  const { inner, outer, mid } = ringRadii(wheelIndex, wheelCount);
  const band = outer - inner;
  const accent = ringAccentColor(ring.ringId);
  const divisions = cfg.divisions;
  const slotWidth = 180 / divisions;
  const activeIdx = Math.floor((((cycleFraction % 1) + 1) % 1) * divisions) % divisions;
  const toothCount = Math.max(18, Math.min(48, Math.round(outer / 9)));
  const teeth = rimGearTeeth(CX, CY, outer, toothCount, Math.min(4.2, Math.max(1.8, band * 0.28)));
  const arcLen = mid * (Math.PI / divisions);
  const baseFont = Math.max(
    3.2,
    Math.min(band * 0.38, arcLen * 0.65, divisions > 48 ? 5 : divisions > 24 ? 6.5 : 8.5),
  );
  const baseIcon = Math.max(5, Math.min(band * 0.55, arcLen * 0.8, 12));
  const preferIcon = divisions <= 20;
  const meshDir = wheelIndex % 2 === 0 ? "cw" : "ccw";
  // How many slots stay readable around the playhead
  const focusSlots = Math.max(1.2, Math.min(3.2, divisions * 0.045));

  const segments = [];
  for (let i = 0; i < divisions; i++) {
    const d = slotOffsetFromPlayhead(i, cycleFraction, divisions);
    const centerDeg = (d / (divisions / 2)) * 90;
    const start = centerDeg - slotWidth / 2;
    const end = centerDeg + slotWidth / 2;
    if (end < -92 || start > 92) continue;

    const vis = ringSegmentVisual(ring.ringId, i, divisions);
    const isActive = i === activeIdx;
    const dist = Math.abs(d);
    const focusT = Math.max(0, 1 - dist / focusSlots);
    const edgeFade = Math.max(0.06, 1 - dist / (divisions * 0.42));
    const markOpacity = isActive ? 1 : 0.1 + focusT * 0.55 + edgeFade * 0.12;
    const plateOpacity = isActive ? 1 : 0.22 + focusT * 0.55 + edgeFade * 0.15;
    const zoom = isActive ? 1.85 : 1 + focusT * 0.55;
    const fontSize = Math.min(band * 0.92, baseFont * zoom * (isActive && ring.ringId === 1 ? 1.25 : 1));
    const iconSize = Math.min(band * 0.95, baseIcon * zoom);
    const ang = tickAngle(centerDeg);
    const lx = CX + Math.cos(ang) * mid;
    const ly = CY + Math.sin(ang) * mid;
    const sectorPath = donutSectorPath(CX, CY, inner + 0.35, outer - 0.35, start, end);
    const showIcon = preferIcon && Boolean(vis.graphicKey) && (isActive || focusT > 0.15);
    const showText = Boolean(vis.label) && (isActive || focusT > 0.08 || edgeFade > 0.35);

    segments.push(
      <g
        key={i}
        className={isActive ? "cp-cosmic-segment-active" : undefined}
        opacity={plateOpacity}
      >
        {isActive && (
          <path
            d={sectorPath}
            fill={accent}
            fillOpacity={0.55}
            filter={`url(#cosmic-seg-glow-${uid})`}
            pointerEvents="none"
          />
        )}
        <path
          d={sectorPath}
          fill={vis.fill}
          fillOpacity={isActive ? 1 : 0.75}
          stroke={isActive ? "#fff4c8" : vis.stroke}
          strokeWidth={isActive ? 1.8 : 0.4}
          strokeOpacity={isActive ? 1 : 0.45}
        />
        {showIcon && (
          <g opacity={markOpacity}>
            <CosmicGraphicIcon
              graphicKey={vis.graphicKey!}
              x={lx}
              y={showText && !isActive ? ly - fontSize * 0.3 : ly}
              size={iconSize}
              color={isActive ? "#fff8e7" : vis.stroke}
              active={isActive}
            />
          </g>
        )}
        {showText && (
          <text
            x={lx}
            y={showIcon && !isActive ? ly + iconSize * 0.28 : ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fill={isActive ? "#fffef5" : `rgba(240, 226, 176, ${0.35 + focusT * 0.65})`}
            fontFamily={OBS.typography.micro}
            fontWeight={isActive ? 700 : 500}
            opacity={markOpacity}
            style={
              isActive
                ? { filter: "drop-shadow(0 0 6px rgba(255, 244, 200, 0.85))" }
                : undefined
            }
          >
            {vis.label}
          </text>
        )}
      </g>,
    );
  }

  return (
    <g
      className={`cosmic-segment-ring cp-steampunk-ring cp-steampunk-ring-${meshDir}`}
      style={{ ["--ring-mid" as string]: `${mid}` }}
    >
      <defs>
        <clipPath id={`cosmic-clip-${uid}-${ring.ringId}`}>
          <path d={semicircleAnnulusPath(CX, CY, outer, inner)} />
        </clipPath>
      </defs>
      <path
        d={semicircleAnnulusPath(CX, CY, outer, inner)}
        fill="#1a1510"
        fillOpacity={0.55}
        pointerEvents="none"
      />
      <path
        d={semicircleAnnulusPath(CX, CY, outer, inner)}
        fill={accent}
        fillOpacity={0.08}
        pointerEvents="none"
      />
      <g
        className={ring.ringId === 1 ? "cp-steampunk-seconds-face" : undefined}
        clipPath={`url(#cosmic-clip-${uid}-${ring.ringId})`}
      >
        {segments}
      </g>
      <path
        d={semicircleAnnulusPath(CX, CY, outer, inner)}
        fill="none"
        stroke="#c9a227"
        strokeWidth={1.15}
        strokeOpacity={0.75}
        pointerEvents="none"
      />
      <path
        d={`M ${CX - inner} ${CY} A ${inner} ${inner} 0 0 1 ${CX + inner} ${CY}`}
        fill="none"
        stroke="#8a6b1e"
        strokeWidth={0.7}
        strokeOpacity={0.55}
        pointerEvents="none"
      />
      <g className={`cp-steampunk-rim-teeth cp-steampunk-mesh-${meshDir}`}>
        {teeth.map(t => (
          <path
            key={t.key}
            d={t.d}
            fill="#3d3018"
            stroke="#c9a227"
            strokeWidth={0.45}
            opacity={0.95}
            pointerEvents="none"
          />
        ))}
      </g>
      {(() => {
        const nameDeg = -78;
        const nameAng = tickAngle(nameDeg);
        const nx = CX + Math.cos(nameAng) * mid;
        const ny = CY + Math.sin(nameAng) * mid;
        const labelSize = Math.max(5.5, Math.min(9, band * 0.36));
        return (
          <g pointerEvents="none">
            <text
              x={nx}
              y={ny - labelSize * 0.45}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={labelSize}
              fill={accent}
              fillOpacity={0.98}
              fontFamily={OBS.typography.micro}
              fontWeight={700}
              letterSpacing="0.03em"
            >
              {shortName}
            </text>
            <text
              x={nx}
              y={ny + labelSize * 0.55}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(4.5, labelSize * 0.78)}
              fill="rgba(240, 226, 176, 0.78)"
              fontFamily={OBS.typography.micro}
              fontWeight={600}
            >
              {nowHint}
            </text>
          </g>
        );
      })()}
      <PlayheadSlot inner={inner} outer={outer} />
    </g>
  );
}

function buildStarfield(count: number): { x: number; y: number; r: number; op: number; phase: number }[] {
  const stars = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 7919 + 104729;
    const x = 40 + (seed % 720);
    const y = 8 + ((seed * 13) % 360);
    if (y > CY - 24) continue;
    stars.push({
      x,
      y,
      r: 0.35 + (seed % 6) * 0.12,
      op: 0.12 + (seed % 9) * 0.06,
      phase: (seed % 360) / 360,
    });
  }
  return stars;
}

export function CosmicClockWheel({
  snapshot,
  className = "",
  showReadout = false,
  weather = null,
  showAtlasRings = false,
}: CosmicClockWheelProps) {
  const uid = useId().replace(/:/g, "");
  const wheelRings = useMemo(() => {
    const byId = new Map(snapshot.rings.map(r => [r.ringId, r]));
    const core = WHEEL_VISIBLE_RING_IDS.map(id => byId.get(id)).filter((r): r is ClockRingData => r != null);
    const atlas = showAtlasRings
      ? snapshot.rings.filter(r => r.ringId >= 11).slice(0, WHEEL_ATLAS_RING_CAP)
      : [];
    return [...core, ...atlas];
  }, [snapshot.rings, showAtlasRings]);

  const fractionSprings = useRingFractionSprings(wheelRings);
  const stars = useMemo(() => buildStarfield(96), []);
  const wheelCount = wheelRings.length;
  const playheadTop = CY - OUTER_R - 12;
  const hubTime = formatHubTime24(snapshot.date);
  const hubDate = formatHubCivilDate(snapshot.date);
  const moonRing = snapshot.rings.find(r => r.ringId === 6);
  const moonGlyph = moonRing?.activeSegment.symbol ?? "☽";
  const moonLabel = moonRing?.activeSegment.name ?? "Moon";
  const weatherGlyph = weather?.emoji && weather.emoji !== "·" ? weather.emoji : "·";
  const weatherLabel = weather?.condition ?? "—";
  const weatherTemp =
    weather?.tempC != null && Number.isFinite(weather.tempC)
      ? `${Math.round(weather.tempC)}°`
      : null;
  const [tickPulse, setTickPulse] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);
  const sec = snapshot.date.getSeconds();

  useEffect(() => {
    setTickPulse(true);
    const t = window.setTimeout(() => setTickPulse(false), 120);
    return () => window.clearTimeout(t);
  }, [sec]);

  return (
    <div
      className={[
        "cp-cosmic-clock-wheel cp-steampunk-clock-wheel relative w-full mx-auto overflow-hidden",
        tickPulse ? "cp-steampunk-tick" : "",
        "rounded-2xl border border-[#8a6b1e]/35 bg-[#0a0806]",
        "shadow-[0_20px_64px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(232,200,106,0.12)]",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 800 450"
        className="cp-cosmic-clock-svg block w-full select-none"
        preserveAspectRatio="xMidYMax slice"
        role="img"
        aria-label="Cosmic clock semi-circle wheel"
      >
        <defs>
          <radialGradient id={`cosmic-bg-${uid}`} cx="50%" cy="100%" r="85%">
            <stop offset="0%" stopColor="#1c1610" />
            <stop offset="40%" stopColor="#0D111A" />
            <stop offset="100%" stopColor="#05070B" />
          </radialGradient>
          <radialGradient id={`cosmic-hub-${uid}`} cx="50%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#1a1510" />
            <stop offset="55%" stopColor="#0a0d14" />
            <stop offset="100%" stopColor="#05070B" />
          </radialGradient>
          <linearGradient id="cp-steam-pawl-fill" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#8a6b1e" stopOpacity={0.2} />
            <stop offset="50%" stopColor="#e8c86a" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#c9a227" stopOpacity={0.25} />
          </linearGradient>
          <radialGradient id={`cp-steam-hub-${uid}`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#3d3018" />
            <stop offset="55%" stopColor="#1a1510" />
            <stop offset="100%" stopColor="#0a0806" />
          </radialGradient>
          <linearGradient id="cp-playhead-slot-fill" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="var(--gold-lt)" stopOpacity={0.05} />
            <stop offset="50%" stopColor="var(--gold-lt)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--gold-lt)" stopOpacity={0.12} />
          </linearGradient>
          <linearGradient id={`cosmic-needle-${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="var(--gold-dp)" stopOpacity={0.35} />
            <stop offset="45%" stopColor="var(--gold-lt)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#fff8e7" stopOpacity={1} />
          </linearGradient>
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
          <filter id={`cosmic-seg-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={0} y={0} width={800} height={450} fill={`url(#cosmic-bg-${uid})`} />

        <g clipPath={`url(#cosmic-dome-${uid})`} className="cp-cosmic-starfield">
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#e8eef8"
              fillOpacity={s.op}
              className="cp-cosmic-star"
              style={{ animationDelay: `${s.phase * 4}s` }}
            />
          ))}
        </g>

        <g clipPath={`url(#cosmic-dome-${uid})`}>
          <path
            d={`M ${CX - OUTER_R - 20} ${CY} A ${OUTER_R + 20} ${OUTER_R + 20} 0 0 1 ${CX + OUTER_R + 20} ${CY}`}
            fill="none"
            stroke={OBS.celestial.horizon}
            strokeWidth={1.5}
            className="cp-cosmic-horizon-glow"
          />
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={20}
            stroke={OBS.celestial.meridian}
            strokeWidth={0.75}
            strokeDasharray="4 6"
            strokeOpacity={0.45}
          />

          {wheelRings.map((ring, index) => (
            <CosmicSegmentRing
              key={ring.ringId}
              ring={ring}
              wheelIndex={index}
              uid={uid}
              wheelCount={wheelCount}
              cycleFraction={fractionSprings.get(ring.ringId) ?? 0}
              nowHint={ringNowHint(ring, snapshot.date)}
            />
          ))}
        </g>

        <g className="cp-cosmic-playhead cosmic-playhead" filter={`url(#cosmic-glow-${uid})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={playheadTop}
            stroke={`url(#cosmic-needle-${uid})`}
            strokeWidth={3}
            strokeLinecap="round"
            className="cp-cosmic-needle"
          />
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={playheadTop}
            stroke="var(--gold-lt)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeOpacity={0.08}
          />
          <polygon
            points={`${CX},${playheadTop - 8} ${CX + 7},${playheadTop + 3} ${CX - 7},${playheadTop + 3}`}
            fill="var(--gold-lt)"
            className="cp-cosmic-needle-cap"
          />
          <text
            x={CX}
            y={playheadTop - 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--gold-lt)"
            fontFamily={OBS.typography.micro}
            fontWeight={700}
            letterSpacing="0.2em"
            className="cp-cosmic-now-label"
          >
            NOW
          </text>
        </g>

        <g className="cp-cosmic-hub cp-steampunk-hub">
          <path
            d={gearTeethPath(CX, CY, HUB_R + 8, 18, 2.4)}
            fill="#2a2218"
            stroke="#c9a227"
            strokeWidth={0.55}
            className="cp-steampunk-escapement"
          />
          <path
            d={`M ${CX - HUB_R - 8} ${CY} A ${HUB_R + 8} ${HUB_R + 8} 0 0 1 ${CX + HUB_R + 8} ${CY} Z`}
            fill={`url(#cp-steam-hub-${uid})`}
            stroke="#8a6b1e"
            strokeWidth={1.6}
          />
          <path
            d={`M ${CX - HUB_R + 2} ${CY} A ${HUB_R - 2} ${HUB_R - 2} 0 0 1 ${CX + HUB_R - 2} ${CY} Z`}
            fill="#0c0a08"
            fillOpacity={0.72}
            stroke="#c9a227"
            strokeWidth={0.7}
            strokeOpacity={0.55}
          />

          {/* Civil tells — moon + weather flanking the time */}
          <text x={CX - 28} y={CY - 36} textAnchor="middle" fontSize={14} className="cp-cosmic-hub-tell">
            {moonGlyph}
          </text>
          <text x={CX + 28} y={CY - 36} textAnchor="middle" fontSize={14} className="cp-cosmic-hub-tell">
            {weatherGlyph}
          </text>
          <text
            x={CX}
            y={CY - 38}
            textAnchor="middle"
            fontSize={6}
            fill="var(--gold-dp)"
            fontFamily={OBS.typography.micro}
            fontWeight={600}
            letterSpacing="0.16em"
          >
            LOCAL
          </text>
          <text
            x={CX}
            y={CY - 14}
            textAnchor="middle"
            fontSize={17}
            fill="var(--gold-lt)"
            fontFamily={OBS.typography.micro}
            fontWeight={700}
            className="cp-cosmic-hub-time"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {hubTime}
          </text>
          <text
            x={CX}
            y={CY + 2}
            textAnchor="middle"
            fontSize={8}
            fill="rgba(240, 226, 176, 0.9)"
            fontFamily={OBS.typography.micro}
            fontWeight={600}
            className="cp-cosmic-hub-date"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {hubDate}
          </text>
        </g>
      </svg>

      <div className="cp-clock-chrome">
        <div className="cp-clock-hub-tells" aria-label="Moon and weather">
          <span className="cp-clock-hub-tell">
            <span aria-hidden>{moonGlyph}</span> {moonLabel}
          </span>
          <span className="cp-clock-hub-tell">
            <span aria-hidden>{weatherGlyph}</span>{" "}
            {weatherTemp ? `${weatherTemp} ` : ""}
            {weatherLabel}
          </span>
        </div>
        <div className="cp-clock-legend" aria-label="Clock rings">
          {wheelRings.map(ring => (
            <span key={ring.ringId} className="cp-clock-legend-item">
              <span
                className="cp-clock-legend-dot"
                style={{ background: ringAccentColor(ring.ringId) }}
                aria-hidden
              />
              <span className="cp-clock-legend-name">{ringShortName(ring)}</span>
              <span className="cp-clock-legend-value">{ringNowHint(ring, snapshot.date)}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          className={`cp-clock-howto-btn${howtoOpen ? " cp-clock-howto-btn-open" : ""}`}
          aria-expanded={howtoOpen}
          onClick={() => setHowtoOpen(v => !v)}
        >
          How to read
        </button>
        {howtoOpen && (
          <p className="cp-clock-howto-body">
            The gold marker at the top is now. Each ring is a cycle — the mark under the marker is the
            current value. Hub shows local time and date; moon and weather sit just below. Culture
            calendars live in Atlas and in the readout under the clock.
          </p>
        )}
      </div>

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
