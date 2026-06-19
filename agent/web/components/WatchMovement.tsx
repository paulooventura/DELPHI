"use client";

import { useId, useRef, type ReactElement, type PointerEvent as ReactPointerEvent } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { daysInMonth } from "../lib/cycleSystems";
import { labelForDistanceRank } from "../lib/starmap";

export type CalendarWheel = CycleSnapshot["wheelLayers"][number];
export type GregorianInfo = CycleSnapshot["gregorian"];

export type WatchMovementProps = {
  now: Date;
  cycles: CycleSnapshot | null;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  glass?: boolean;
  heading?: number;
  emfUt?: number | null;
  showCompass?: boolean;
  skyDistance?: number;
  onSkyDistanceChange?: (rank: number) => void;
  semicircle?: boolean;
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
}: {
  cx: number;
  cy: number;
  heading: number;
  emfUt: number | null;
  showCompass: boolean;
  glass?: boolean;
}) {
  const r = 26;
  const needle = showCompass ? heading : 0;
  const op = glass ? 0.92 : 1;

  return (
    <g opacity={op}>
      <circle cx={cx} cy={cy} r={r + 4} fill="rgba(6,10,18,0.82)" stroke="#c9a227" strokeWidth={1.4} />
      <circle cx={cx} cy={cy} r={r} fill="rgba(8,14,24,0.6)" stroke="#2a4868" strokeWidth={1} />

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
              stroke={label === "N" ? "#ef4444" : major ? "#4a7090" : "#2a4058"}
              strokeWidth={major ? 1.3 : 0.7}
            />
            {(major || label === "N") && (
              <text
                x={cx + Math.cos(rad) * (r - 9)}
                y={cy + Math.sin(rad) * (r - 9) + 2}
                textAnchor="middle"
                fontSize={label === "N" ? 7.5 : major ? 5.5 : 4}
                fill={label === "N" ? "#ef4444" : "#5a8cb0"}
                fontWeight={label === "N" ? 800 : major ? 600 : 400}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      <g transform={`rotate(${needle} ${cx} ${cy})`}>
        <polygon points={`${cx},${cy - r + 4} ${cx + 3},${cy + 3} ${cx - 3},${cy + 3}`} fill="#ef4444" opacity={0.95} />
        <polygon points={`${cx},${cy + r - 4} ${cx + 2.5},${cy - 1} ${cx - 2.5},${cy - 1}`} fill="#3a6080" opacity={0.85} />
      </g>

      <circle cx={cx} cy={cy} r={3} fill="#c9a227" stroke="#8b6914" strokeWidth={0.6} />

      {emfUt != null && (
        <text x={cx} y={cy + r + 11} textAnchor="middle" fontSize={6.5} fill="#7dd3fc" fontFamily="monospace">
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
  onChange,
}: {
  cx: number;
  cy: number;
  radius: number;
  distanceRank: number;
  glass?: boolean;
  onChange: (rank: number) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const dragging = useRef(false);
  const band = Math.max(9, radius * 0.13);
  const inner = radius - band;
  const midR = radius - band / 2;
  const divisions = 100;
  const dialSpin = -(distanceRank / divisions) * 360;
  const ringOpacity = glass ? 0.58 : 0.92;
  const fontSize = Math.max(3, Math.min(band * 0.65, 5.5));

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
        stroke={isMajor ? "#38bdf8" : "#2a4868"}
        strokeWidth={isMajor ? 0.85 : 0.35}
        opacity={isMajor ? 0.9 : 0.4}
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
        fontSize={i === 0 ? fontSize + 1.5 : fontSize}
        fill={i === 0 ? "#e8f4ff" : "#7dd3fc"}
        fontFamily="Georgia, serif"
        fontWeight={600}
        transform={`rotate(${rot}, ${lx}, ${ly})`}
      >
        {txt}
      </text>,
    );
  }

  return (
    <g
      className="cp-watch-ring cp-distance-ring"
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
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity={glass ? 0.55 : 0.95} />
          <stop offset="50%" stopColor="#0ea5e9" stopOpacity={glass ? 0.5 : 0.9} />
          <stop offset="100%" stopColor="#1e3a5f" stopOpacity={glass ? 0.55 : 1} />
        </linearGradient>
        <clipPath id={`dist-clip-${uid}`}>
          <path d={ringDonutClip(cx, cy, radius, inner)} fillRule="evenodd" />
        </clipPath>
      </defs>

      <g transform={`rotate(${dialSpin} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={`url(#dist-br-${uid})`} strokeWidth={band} />
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke="#061018" strokeWidth={band - 1.6} opacity={glass ? 0.25 : 0.45} />
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
        stroke="#38bdf8"
        strokeWidth={1.4}
        strokeLinecap="round"
      />

      <text
        x={cx}
        y={cy + radius + 14}
        textAnchor="middle"
        fontSize={7}
        fill="#7dd3fc"
        fontFamily="monospace"
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
  glass,
  onEnter,
  onLeave,
}: {
  cx: number;
  cy: number;
  spec: RingSpec;
  active: boolean;
  glass?: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const r = spec.radius;
  const band = spec.dense ? Math.max(9, r * 0.13) : Math.max(4, r * 0.08);
  const inner = r - band;
  const midR = r - band / 2;
  const ringOpacity = glass ? 0.52 : 0.9;
  const dialSpin = -spec.nowAngle;
  const fontSize = spec.dense
    ? Math.max(3.2, Math.min(band * 0.72, (360 / spec.divisions) * 0.2))
    : spec.id === "weather"
      ? Math.max(5, band * 0.65)
      : Math.max(4.5, band * 0.5);

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
        stroke={isMajor ? spec.color : "#4a4030"}
        strokeWidth={isMajor ? 0.85 : 0.4}
        strokeLinecap="butt"
        opacity={isMajor ? 0.85 : 0.45}
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
        fill="#e8c872"
        fontFamily="Georgia, serif"
        fontWeight={600}
        transform={`rotate(${rot}, ${lx}, ${ly})`}
      >
        {txt}
      </text>,
    );
  }

  return (
    <g
      className={`cp-watch-ring${active ? " cp-watch-ring-active" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer" }}
      opacity={ringOpacity}
    >
      <defs>
        <linearGradient id={`br-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c872" stopOpacity={glass ? 0.65 : 1} />
          <stop offset="50%" stopColor={spec.color} stopOpacity={glass ? 0.6 : 0.95} />
          <stop offset="100%" stopColor="#5a4a22" stopOpacity={glass ? 0.55 : 1} />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <path d={ringDonutClip(cx, cy, r, inner)} fillRule="evenodd" />
        </clipPath>
      </defs>

      <g transform={`rotate(${dialSpin} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={`url(#br-${uid})`} strokeWidth={band} />
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke="#0a0806" strokeWidth={band - 1.6} opacity={glass ? 0.2 : 0.45} />
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
        stroke="#f0d060"
        strokeWidth={1.3}
        strokeLinecap="round"
        opacity={0.95}
      />
    </g>
  );
}

export function WatchMovement({
  now,
  cycles,
  hoverId,
  onHover,
  glass = false,
  heading = 0,
  emfUt = null,
  showCompass = true,
  skyDistance = 50,
  onSkyDistanceChange,
  semicircle = false,
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
      {!glass && (
        <>
          <defs>
            <radialGradient id="watch-bg" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#2a2218" />
              <stop offset="55%" stopColor="#12100c" />
              <stop offset="100%" stopColor="#080604" />
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={400} height={400} fill="url(#watch-bg)" rx={8} />
        </>
      )}

      {onSkyDistanceChange && (
        <DistanceDialRing
          cx={cx}
          cy={cy}
          radius={distanceRadius}
          distanceRank={skyDistance}
          glass={glass}
          onChange={onSkyDistanceChange}
        />
      )}

      {[...rings].reverse().map((spec) => (
        <RotatingDialRing
          key={spec.id}
          cx={cx}
          cy={cy}
          spec={spec}
          active={hoverId === spec.id}
          glass={glass}
          onEnter={() => onHover(spec.id)}
          onLeave={() => onHover(null)}
        />
      ))}

      <HubCompass
        cx={cx}
        cy={cy}
        heading={heading}
        emfUt={emfUt}
        showCompass={showCompass}
        glass={glass}
      />
      </g>
    </svg>
  );
}
