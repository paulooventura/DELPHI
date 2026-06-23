"use client";

import { useId, useRef, type ReactElement, type PointerEvent as ReactPointerEvent } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { daysInMonth } from "../lib/cycleSystems";
import { OBS, spectrumAccent, spectrumBlend } from "../lib/design/observatoryTokens";
import { labelForDistanceRank } from "../lib/starmap";

export type CalendarWheel = CycleSnapshot["wheelLayers"][number];
export type GregorianInfo = CycleSnapshot["gregorian"];

export type WatchMovementProps = {
  now: Date;
  cycles: CycleSnapshot | null;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  focusRingId?: string | null;
  onRingSelect?: (id: string, meta: { radius: number }) => void;
  glass?: boolean;
  heading?: number;
  emfUt?: number | null;
  showCompass?: boolean;
  skyDistance?: number;
  onSkyDistanceChange?: (rank: number) => void;
  semicircle?: boolean;
  /** 0 = daylight blue, 1 = night amber (lux spectrum). */
  spectrumWarmth?: number;
};

type RingSpec = {
  id: string;
  radius: number;
  color: string;
  nowAngle: number;
  divisions: number;
  /** Label every N divisions (1 = all) */
  labelEvery: number;
  labelPad?: number;
  /** Wider band for dense numeric rings */
  dense?: boolean;
  /** Override auto labels (months, weekdays, …) */
  customLabel?: (index: number, divisions: number) => string | null;
};

function tickRad(index: number, divisions: number): number {
  return ((index / divisions) * 360 - 90) * (Math.PI / 180);
}

function ringDonutClip(cx: number, cy: number, outer: number, inner: number): string {
  return [
    `M ${cx} ${cy - outer} A ${outer} ${outer} 0 1 1 ${cx} ${cy + outer} A ${outer} ${outer} 0 1 1 ${cx} ${cy - outer}`,
    `M ${cx} ${cy - inner} A ${inner} ${inner} 0 1 0 ${cx} ${cy + inner} A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner}`,
  ].join(" ");
}

function msAngle(d: Date): number {
  return ((d.getMilliseconds() % 100) / 100) * 360;
}

function secAngle(d: Date): number {
  const sec = d.getSeconds() + d.getMilliseconds() / 1000;
  return (sec / 60) * 360;
}

function minAngle(d: Date): number {
  const sec = d.getSeconds() + d.getMilliseconds() / 1000;
  const min = d.getMinutes() + sec / 60;
  return (min / 60) * 360;
}

function hourAngle(d: Date): number {
  const sec = d.getSeconds() + d.getMilliseconds() / 1000;
  const min = d.getMinutes() + sec / 60;
  const hr = d.getHours() + min / 60;
  return (hr / 24) * 360;
}

function cycleAngle(periodDays: number, d: Date): number {
  if (periodDays <= 0) return 0;
  const boost = 180;
  const periodMs = (periodDays * 86400000) / boost;
  return ((d.getTime() % periodMs) / periodMs) * 360;
}

function dayProgress(now: Date): number {
  return (now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 + now.getMilliseconds() / 86400000) / 24;
}

const TZOLKIN_SIGNS = [
  "Imix", "Ik", "Akbal", "Kan", "Chikchan", "Kimi", "Manik", "Lamat", "Muluk", "Ok",
  "Chuen", "Eb", "Ben", "Ix", "Men", "Kib", "Kaban", "Etznab", "Kawak", "Ajaw",
];
const CHINESE_SYMBOLS = ["🐀", "🐂", "🐅", "🐇", "🐉", "🐍", "🐴", "🐑", "🐒", "🐓", "🐕", "🐖"];
const CHINESE_ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const MOON_PHASE_EMOJI = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

function wheelToRing(w: CalendarWheel, now: Date): Omit<RingSpec, "radius"> {
  const short = w.label.replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 6);
  return {
    id: w.id,
    color: w.color,
    nowAngle: cycleAngle(w.periodDays, now),
    divisions: 12,
    labelEvery: 3,
    customLabel: i => (i === 0 ? `${w.icon}${short}` : null),
  };
}

function buildRingSpecs(now: Date, cycles: CycleSnapshot | null): Omit<RingSpec, "radius">[] {
  const specs: Omit<RingSpec, "radius">[] = [
    { id: "ms", color: "#fbbf24", nowAngle: msAngle(now), divisions: 100, labelEvery: 10, labelPad: 2, dense: true },
    { id: "s", color: "#f97316", nowAngle: secAngle(now), divisions: 60, labelEvery: 1, labelPad: 0, dense: true },
    { id: "min", color: "#ef4444", nowAngle: minAngle(now), divisions: 60, labelEvery: 1, labelPad: 0, dense: true },
    { id: "h", color: "#d946ef", nowAngle: hourAngle(now), divisions: 24, labelEvery: 1, labelPad: 0, dense: true },
  ];

  if (!cycles) return specs;

  const localYear = now.getFullYear();
  const localMonth = now.getMonth() + 1;
  const localDay = now.getDate();
  const dim = daysInMonth(localYear, localMonth);
  const wd = now.getDay();
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hourly = cycles.weather?.hourly;

  // Weather — hourly forecast icons (0–23), aligned to viewer local clock
  specs.push({
    id: "weather",
    color: "#22d3ee",
    nowAngle: hourAngle(now),
    divisions: 24,
    labelEvery: 1,
    customLabel: i => {
      const slot = hourly?.find(h => h.hour === i);
      if (slot?.emoji && slot.emoji !== "·") return slot.emoji;
      if (i === now.getHours()) return cycles.weather?.emoji ?? "·";
      return "·";
    },
  });

  // Day of month — divisions match this month's length (28–31)
  specs.push({
    id: "day",
    color: "#c084fc",
    nowAngle: ((localDay - 1 + dayProgress(now)) / dim) * 360,
    divisions: dim,
    labelEvery: 1,
    labelPad: 0,
    dense: true,
    customLabel: i => (i < dim ? String(i + 1) : null),
  });

  // Weekday (outside day ring)
  specs.push({
    id: "weekday",
    color: "#94a3b8",
    nowAngle: (wd / 7) * 360,
    divisions: 7,
    labelEvery: 1,
    customLabel: i => weekdays[i] ?? null,
  });

  // Chinese zodiac — icon + name
  const cnIdx = CHINESE_ANIMALS.findIndex(a => a === cycles.chineseZodiac.animal);
  specs.push({
    id: "chinese-sign",
    color: "#dc2626",
    nowAngle: ((cnIdx >= 0 ? cnIdx : 0) / 12) * 360,
    divisions: 12,
    labelEvery: 1,
    customLabel: i => `${CHINESE_SYMBOLS[i] ?? "·"}${CHINESE_ANIMALS[i]?.slice(0, 3) ?? ""}`,
  });

  // Mayan tzolkin day sign
  const tzIdx = TZOLKIN_SIGNS.indexOf(cycles.tzolkin.sign);
  specs.push({
    id: "tzolkin",
    color: "#7c3aed",
    nowAngle: ((cycles.tzolkin.kin - 1) / 260) * 360,
    divisions: 20,
    labelEvery: 1,
    customLabel: i => (i === tzIdx ? `🧭${cycles.tzolkin.sign.slice(0, 4)}` : TZOLKIN_SIGNS[i]?.slice(0, 3) ?? null),
  });

  // Moon phase
  const phaseIdx = Math.min(7, Math.floor(cycles.lunar.fraction * 8));
  specs.push({
    id: "moon",
    color: "#94a3b8",
    nowAngle: cycles.lunar.angleDeg,
    divisions: 8,
    labelEvery: 1,
    customLabel: i => (i === phaseIdx ? `${cycles.lunar.emoji}${cycles.lunar.phase.slice(0, 3)}` : MOON_PHASE_EMOJI[i] ?? null),
  });

  // Remaining calendar layers (kin, wavespell, castle, months, zodiac, season, years…)
  const SKIP = new Set(["day", "chinese-sign", "moon"]);
  for (const w of cycles.wheelLayers) {
    if (SKIP.has(w.id)) continue;
    specs.push(wheelToRing(w, now));
  }

  return specs;
}

/** Outermost ring radius (px) for default hero zoom. */
export function clockOuterRadius(cycles: CycleSnapshot | null, now = new Date()): number {
  const hubR = 26;
  const TIME_IDS = new Set(["ms", "s", "min", "h"]);
  let ri = 0;
  let last = hubR + 12;
  for (const spec of buildRingSpecs(now, cycles)) {
    const step = TIME_IDS.has(spec.id) ? 10 : spec.id === "weather" ? 9 : 7;
    last = hubR + 12 + ri * step;
    ri += 1;
  }
  return last;
}

const COMPASS_DIRS: Array<{ deg: number; label: string; major: boolean }> = [
  { deg: 0, label: "N", major: true },
  { deg: 22.5, label: "NNE", major: false },
  { deg: 45, label: "NE", major: true },
  { deg: 67.5, label: "ENE", major: false },
  { deg: 90, label: "E", major: true },
  { deg: 112.5, label: "ESE", major: false },
  { deg: 135, label: "SE", major: true },
  { deg: 157.5, label: "SSE", major: false },
  { deg: 180, label: "S", major: true },
  { deg: 202.5, label: "SSW", major: false },
  { deg: 225, label: "SW", major: true },
  { deg: 247.5, label: "WSW", major: false },
  { deg: 270, label: "W", major: true },
  { deg: 292.5, label: "WNW", major: false },
  { deg: 315, label: "NW", major: true },
  { deg: 337.5, label: "NNW", major: false },
];

function HubCompass({
  cx,
  cy,
  heading,
  emfUt,
  showCompass,
  glass,
  warmth = 0.55,
}: {
  cx: number;
  cy: number;
  heading: number;
  emfUt: number | null;
  showCompass: boolean;
  glass?: boolean;
  warmth?: number;
}) {
  const r = 26;
  const needle = showCompass ? heading : 0;
  const op = glass ? 0.92 : 1;
  const accent = spectrumAccent(warmth);
  const labelInk = spectrumBlend(warmth, OBS.day.ink, OBS.night.gold);

  return (
    <g opacity={op} className="cp-watch-hub">
      <circle cx={cx} cy={cy} r={r + 4} fill="rgba(5, 7, 11, 0.88)" stroke={OBS.vector.structuralStrong} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r} fill="rgba(13, 17, 26, 0.55)" stroke={OBS.vector.structural} strokeWidth={0.75} />

      {COMPASS_DIRS.map(({ deg, label, major }) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const inner = r - (major ? 5 : 7);
        const outer = r - 1;
        return (
          <g key={label}>
            <line
              x1={cx + Math.cos(rad) * inner}
              y1={cy + Math.sin(rad) * inner}
              x2={cx + Math.cos(rad) * outer}
              y2={cy + Math.sin(rad) * outer}
              stroke={label === "N" ? accent : major ? OBS.vector.structuralStrong : OBS.vector.structural}
              strokeWidth={major ? 1 : 0.75}
              strokeLinecap="round"
            />
            {(major || label === "N") && (
              <text
                x={cx + Math.cos(rad) * (r - 9)}
                y={cy + Math.sin(rad) * (r - 9) + 2}
                textAnchor="middle"
                fontSize={label === "N" ? 7 : major ? 5.5 : 4}
                fill={label === "N" ? accent : labelInk}
                fontWeight={label === "N" ? 700 : major ? 600 : 400}
                fontFamily={OBS.typography.micro}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      <g transform={`rotate(${needle} ${cx} ${cy})`}>
        <polygon points={`${cx},${cy - r + 4} ${cx + 2.5},${cy + 3} ${cx - 2.5},${cy + 3}`} fill={accent} opacity={0.95} />
        <polygon points={`${cx},${cy + r - 4} ${cx + 2},${cy - 1} ${cx - 2},${cy - 1}`} fill={OBS.vector.structuralStrong} opacity={0.75} />
      </g>

      <circle cx={cx} cy={cy} r={2.5} fill={accent} stroke={OBS.vector.structural} strokeWidth={0.5} />

      {emfUt != null && (
        <text
          x={cx}
          y={cy + r + 11}
          textAnchor="middle"
          fontSize={6.5}
          fill={labelInk}
          fontFamily={OBS.typography.micro}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {emfUt.toFixed(1)} µT
        </text>
      )}
    </g>
  );
}

function DistanceDialRing({
  cx,
  cy,
  radius,
  distanceRank,
  glass,
  warmth = 0.55,
  onChange,
}: {
  cx: number;
  cy: number;
  radius: number;
  distanceRank: number;
  glass?: boolean;
  warmth?: number;
  onChange: (rank: number) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const dragging = useRef(false);
  const band = Math.max(8, radius * 0.11);
  const inner = radius - band;
  const midR = radius - band / 2;
  const divisions = 100;
  const dialSpin = -(distanceRank / divisions) * 360;
  const ringOpacity = glass ? 0.62 : 0.88;
  const fontSize = Math.max(3, Math.min(band * 0.62, 5.2));
  const accent = spectrumAccent(warmth);
  const labelInk = spectrumBlend(warmth, OBS.day.ink, OBS.night.gold);

  function rankFromPointer(e: ReactPointerEvent<SVGGElement>) {
    const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 400;
    const py = ((e.clientY - rect.top) / rect.height) * 400;
    const ang = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
    const norm = ((ang % 360) + 360) % 360;
    const dialSpin = -(distanceRank / 100) * 360;
    const adjusted = ((norm - dialSpin) % 360 + 360) % 360;
    return Math.max(0, Math.min(100, Math.round((adjusted / 360) * 100)));
  }

  const boundaries: ReactElement[] = [];
  const labels: ReactElement[] = [];

  for (let i = 0; i <= divisions; i++) {
    const ang = tickRad(i, divisions);
    const isMajor = i % 10 === 0;
    boundaries.push(
      <line
        key={`db${i}`}
        x1={cx + Math.cos(ang) * inner}
        y1={cy + Math.sin(ang) * inner}
        x2={cx + Math.cos(ang) * (radius - 0.5)}
        y2={cy + Math.sin(ang) * (radius - 0.5)}
        stroke={isMajor ? accent : OBS.vector.structural}
        strokeWidth={isMajor ? 1 : 0.75}
        strokeLinecap="round"
        opacity={isMajor ? 0.85 : 0.45}
      />,
    );
  }

  for (let i = 0; i <= divisions; i += 10) {
    const ang = tickRad(i, divisions);
    const lx = cx + Math.cos(ang) * midR;
    const ly = cy + Math.sin(ang) * midR;
    const rot = (ang * 180) / Math.PI + 90;
    const txt = i === 0 ? "☽" : String(i);
    labels.push(
      <text
        key={`dl${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={i === 0 ? fontSize + 1.2 : fontSize}
        fill={i === 0 ? labelInk : accent}
        fontFamily={OBS.typography.micro}
        fontWeight={600}
        style={{ fontVariantNumeric: "tabular-nums" }}
        transform={`rotate(${rot}, ${lx}, ${ly})`}
      >
        {txt}
      </text>,
    );
  }

  return (
    <g
      className="cp-watch-ring cp-distance-ring cp-watch-ring-fore"
      opacity={ringOpacity}
      style={{ cursor: "grab" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(rankFromPointer(e));
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        e.stopPropagation();
        onChange(rankFromPointer(e));
      }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <defs>
        <linearGradient id={`dist-br-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={glass ? 0.45 : 0.75} />
          <stop offset="50%" stopColor={OBS.day.accent} stopOpacity={glass ? 0.35 : 0.65} />
          <stop offset="100%" stopColor={OBS.space.core} stopOpacity={glass ? 0.5 : 0.85} />
        </linearGradient>
        <clipPath id={`dist-clip-${uid}`}>
          <path d={ringDonutClip(cx, cy, radius, inner)} fillRule="evenodd" />
        </clipPath>
      </defs>

      <g transform={`rotate(${dialSpin} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={`url(#dist-br-${uid})`} strokeWidth={band * 0.85} />
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={OBS.space.outer} strokeWidth={band - 2} opacity={glass ? 0.2 : 0.35} />
        <g clipPath={`url(#dist-clip-${uid})`}>
          {boundaries}
          {labels}
        </g>
      </g>

      <line
        x1={cx}
        y1={cy - radius - 1}
        x2={cx}
        y2={cy - inner + 1}
        stroke={accent}
        strokeWidth={1}
        strokeLinecap="round"
      />

      <text
        x={cx}
        y={cy + radius + 14}
        textAnchor="middle"
        fontSize={6.5}
        fill={labelInk}
        fontFamily={OBS.typography.micro}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {labelForDistanceRank(distanceRank)}
      </text>
    </g>
  );
}

function RotatingDialRing({
  cx,
  cy,
  spec,
  active,
  focused,
  dimmed,
  glass,
  depthNorm,
  warmth = 0.55,
  onEnter,
  onLeave,
  onSelect,
}: {
  cx: number;
  cy: number;
  spec: RingSpec;
  active: boolean;
  focused?: boolean;
  dimmed?: boolean;
  glass?: boolean;
  /** 0 = inner foreground, 1 = outer cosmic depth. */
  depthNorm: number;
  warmth?: number;
  onEnter: () => void;
  onLeave: () => void;
  onSelect?: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const r = spec.radius;
  const band = spec.dense ? Math.max(8, r * 0.11) : Math.max(3.5, r * 0.07);
  const inner = r - band;
  const midR = r - band / 2;
  const parallax = 1 - depthNorm * 0.38;
  const ringOpacity = dimmed
    ? (glass ? 0.14 : 0.22)
    : focused
      ? (glass ? 0.82 : 0.96)
      : (glass ? 0.38 + parallax * 0.28 : 0.55 + parallax * 0.35);
  const dialSpin = -spec.nowAngle;
  const accent = spectrumAccent(warmth);
  const labelInk = spectrumBlend(warmth, OBS.day.ink, OBS.night.gold);
  const fontSize = spec.dense
    ? Math.max(3, Math.min(band * 0.68, (360 / spec.divisions) * 0.18))
    : spec.id === "weather"
      ? Math.max(4.8, band * 0.62)
      : Math.max(4.2, band * 0.48);
  const depthClass = depthNorm > 0.55 ? " cp-watch-ring-deep" : depthNorm < 0.25 ? " cp-watch-ring-fore" : "";

  const boundaries: ReactElement[] = [];
  const labels: ReactElement[] = [];

  // Radial lines at the start of each slot: |0|1|2|…
  for (let i = 0; i <= spec.divisions; i++) {
    const ang = tickRad(i, spec.divisions);
    const isMajor = i % spec.labelEvery === 0;
    boundaries.push(
      <line
        key={`b${i}`}
        x1={cx + Math.cos(ang) * inner}
        y1={cy + Math.sin(ang) * inner}
        x2={cx + Math.cos(ang) * (r - 0.5)}
        y2={cy + Math.sin(ang) * (r - 0.5)}
        stroke={isMajor ? accent : OBS.vector.structural}
        strokeWidth={isMajor ? 1 : 0.75}
        strokeLinecap="round"
        opacity={isMajor ? 0.75 : 0.4}
      />,
    );
  }

  // Numbers centered in each slot, between boundary lines
  for (let i = 0; i < spec.divisions; i++) {
    if (i % spec.labelEvery !== 0) continue;

    let txt: string | null = null;
    if (spec.customLabel) {
      txt = spec.customLabel(i, spec.divisions);
    } else {
      txt = spec.labelPad != null ? String(i).padStart(spec.labelPad, "0") : String(i);
    }
    if (!txt) continue;

    const ang = tickRad(i + 0.5, spec.divisions);
    const lx = cx + Math.cos(ang) * midR;
    const ly = cy + Math.sin(ang) * midR;
    const rot = (ang * 180) / Math.PI + 90;
    labels.push(
      <text
        key={`l${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fill={labelInk}
        fontFamily={OBS.typography.micro}
        fontWeight={600}
        style={{ fontVariantNumeric: "tabular-nums" }}
        transform={`rotate(${rot}, ${lx}, ${ly})`}
      >
        {txt}
      </text>,
    );
  }

  return (
    <g
      className={`cp-watch-ring${depthClass}${active ? " cp-watch-ring-active" : ""}${focused ? " cp-watch-ring-focused" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={e => {
        e.stopPropagation();
        onSelect?.();
      }}
      style={{ cursor: "pointer" }}
      opacity={ringOpacity}
    >
      <defs>
        <linearGradient id={`br-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={labelInk} stopOpacity={glass ? 0.5 : 0.8} />
          <stop offset="50%" stopColor={spec.color} stopOpacity={glass ? 0.4 : 0.7} />
          <stop offset="100%" stopColor={OBS.space.core} stopOpacity={glass ? 0.45 : 0.75} />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <path d={ringDonutClip(cx, cy, r, inner)} fillRule="evenodd" />
        </clipPath>
      </defs>

      <g transform={`rotate(${dialSpin} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={`url(#br-${uid})`} strokeWidth={band * 0.88} />
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={OBS.space.outer} strokeWidth={band - 2} opacity={glass ? 0.18 : 0.32} />
        <g clipPath={`url(#clip-${uid})`}>
          {boundaries}
          {labels}
        </g>
      </g>

      <line
        x1={cx}
        y1={cy - r - 1}
        x2={cx}
        y2={cy - inner + 1}
        stroke={accent}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={focused ? 0.95 : 0.65}
      />
    </g>
  );
}

export function WatchMovement({
  now,
  cycles,
  hoverId,
  onHover,
  focusRingId = null,
  onRingSelect,
  glass = false,
  heading = 0,
  emfUt = null,
  showCompass = true,
  skyDistance = 50,
  onSkyDistanceChange,
  semicircle = false,
  spectrumWarmth = 0.55,
}: WatchMovementProps) {
  const cx = 200;
  const cy = 200;
  const hubR = 26;
  const TIME_IDS = new Set(["ms", "s", "min", "h"]);
  let ri = 0;

  const rings: RingSpec[] = buildRingSpecs(now, cycles).map(spec => {
    const step = TIME_IDS.has(spec.id) ? 10 : spec.id === "weather" ? 9 : 7;
    const ring = { ...spec, radius: hubR + 12 + ri * step };
    ri++;
    return ring;
  });

  const outerRingR = rings.length > 0 ? rings[rings.length - 1]!.radius : hubR + 12;
  const distanceRadius = outerRingR + 14;
  const maxDepth = Math.max(1, rings.length - 1);

  return (
    <svg
      viewBox={semicircle ? "0 0 400 200" : "0 0 400 400"}
      className={`cp-watch-movement${glass ? " cp-watch-movement-glass" : ""}${semicircle ? " cp-watch-semicircle" : ""}`}
      role="img"
      aria-label="Cycle wheels watch movement"
    >
      {semicircle && (
        <defs>
          <clipPath id="watch-semicircle-clip">
            <rect x={0} y={0} width={400} height={200} />
          </clipPath>
        </defs>
      )}

      <g clipPath={semicircle ? "url(#watch-semicircle-clip)" : undefined}>
      <defs>
        <radialGradient id="watch-bg" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor={OBS.space.core} />
          <stop offset="55%" stopColor="#0a0e16" />
          <stop offset="100%" stopColor={OBS.space.outer} />
        </radialGradient>
        <filter id="watch-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x={0} y={0} width={400} height={400} fill="url(#watch-bg)" rx={8} opacity={glass ? 0.92 : 1} />

      {onSkyDistanceChange && (
        <DistanceDialRing
          cx={cx}
          cy={cy}
          radius={distanceRadius}
          distanceRank={skyDistance}
          glass={glass}
          warmth={spectrumWarmth}
          onChange={onSkyDistanceChange}
        />
      )}

      {[...rings].reverse().map((spec, revIdx) => {
        const depthNorm = maxDepth > 0 ? 1 - revIdx / maxDepth : 0;
        return (
        <RotatingDialRing
          key={spec.id}
          cx={cx}
          cy={cy}
          spec={spec}
          active={hoverId === spec.id}
          focused={focusRingId === spec.id}
          dimmed={focusRingId != null && focusRingId !== spec.id}
          glass={glass}
          depthNorm={depthNorm}
          warmth={spectrumWarmth}
          onEnter={() => onHover(spec.id)}
          onLeave={() => onHover(null)}
          onSelect={() => onRingSelect?.(spec.id, { radius: spec.radius })}
        />
        );
      })}

      <HubCompass
        cx={cx}
        cy={cy}
        heading={heading}
        emfUt={emfUt}
        showCompass={showCompass}
        glass={glass}
        warmth={spectrumWarmth}
      />
      </g>
    </svg>
  );
}
