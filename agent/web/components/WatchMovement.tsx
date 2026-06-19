"use client";

import { useId } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";

export type CalendarWheel = CycleSnapshot["wheelLayers"][number];

export type WatchMovementProps = {
  animMs: number;
  now: Date;
  weather: CycleSnapshot["weather"] | null;
  calendarWheels: CalendarWheel[];
  hoverId: string | null;
  onHover: (id: string | null) => void;
  glass?: boolean;
  heading?: number;
  emfUt?: number | null;
  showCompass?: boolean;
};

const CLOCK_IDS = ["ms", "s", "min", "h"] as const;
const CLOCK_META: Record<(typeof CLOCK_IDS)[number], { color: string }> = {
  ms:  { color: "#fbbf24" },
  s:   { color: "#f97316" },
  min: { color: "#ef4444" },
  h:   { color: "#d946ef" },
};

/** Degrees clockwise from 12 o'clock — current instant on this ring */
function ringAngle(clockId: string, d: Date): number {
  const ms = d.getMilliseconds();
  const sec = d.getSeconds() + ms / 1000;
  const min = d.getMinutes() + sec / 60;
  const hr = (d.getHours() % 12) + min / 60;
  switch (clockId) {
    case "ms": return (ms / 1000) * 360;
    case "s": return (sec / 60) * 360;
    case "min": return (min / 60) * 360;
    case "h": return (hr / 12) * 360;
    default: return 0;
  }
}

function cycleAngle(periodDays: number, d: Date): number {
  if (periodDays <= 0) return 0;
  const boost = 180;
  const periodMs = (periodDays * 86400000) / boost;
  return ((d.getTime() % periodMs) / periodMs) * 360;
}

function compactVal(w: CalendarWheel): string {
  const subNum = w.sublabel.match(/\d+/)?.[0];
  if (subNum) return subNum;
  const labelNum = w.label.match(/\d+/)?.[0];
  if (labelNum) return labelNum;
  const stripped = w.label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return stripped.length <= 4 ? stripped : stripped.slice(0, 3);
}

type RingSpec = {
  id: string;
  radius: number;
  color: string;
  nowAngle: number;
  tickLabels: string[];
  tickCount: number;
};

/** Map tick index → SVG angle (radians), semicircle left→right over top */
function tickRad(i: number, count: number): number {
  return Math.PI + (i / count) * Math.PI;
}

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
  const r = 20;
  const needle = showCompass ? heading : 0;
  const op = glass ? 0.88 : 1;

  return (
    <g opacity={op}>
      <circle cx={cx} cy={cy} r={r + 3} fill="rgba(8,12,20,0.75)" stroke="#c9a227" strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a4060" strokeWidth={1} />

      {["N", "E", "S", "W"].map((label, i) => {
        const ang = ((i * 90 - 90) * Math.PI) / 180;
        const lx = cx + Math.cos(ang) * (r - 4);
        const ly = cy + Math.sin(ang) * (r - 4);
        return (
          <text
            key={label}
            x={lx}
            y={ly + 2}
            textAnchor="middle"
            fontSize={label === "N" ? 7 : 5.5}
            fill={label === "N" ? "#ef4444" : "#4a7090"}
            fontWeight={label === "N" ? 700 : 500}
          >
            {label}
          </text>
        );
      })}

      <g transform={`rotate(${needle} ${cx} ${cy})`}>
        <polygon points={`${cx},${cy - r + 3} ${cx + 2.5},${cy + 2} ${cx - 2.5},${cy + 2}`} fill="#ef4444" opacity={0.95} />
        <polygon points={`${cx},${cy + r - 3} ${cx + 2},${cy - 1} ${cx - 2},${cy - 1}`} fill="#2a4a6a" opacity={0.8} />
      </g>

      <circle cx={cx} cy={cy} r={2.5} fill="#c9a227" />

      {emfUt != null && (
        <text x={cx} y={cy + r + 10} textAnchor="middle" fontSize={6.5} fill="#7dd3fc" fontFamily="monospace">
          {emfUt.toFixed(1)} µT
        </text>
      )}
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
  const band = Math.max(4, r * 0.085);
  const inner = r - band;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const ringOpacity = glass ? 0.55 : 0.92;
  const dialSpin = -spec.nowAngle;

  const ticks = [];
  for (let i = 0; i <= spec.tickCount; i++) {
    const ang = tickRad(i, spec.tickCount);
    const major = i % Math.max(1, Math.floor(spec.tickCount / 4)) === 0 || i === spec.tickCount;
    ticks.push(
      <line
        key={`t${i}`}
        x1={cx + Math.cos(ang) * inner}
        y1={cy + Math.sin(ang) * inner}
        x2={cx + Math.cos(ang) * (r - 0.5)}
        y2={cy + Math.sin(ang) * (r - 0.5)}
        stroke={major ? spec.color : "#5a4a32"}
        strokeWidth={major ? 1.1 : 0.55}
        strokeLinecap="round"
        opacity={major ? 0.95 : 0.55}
      />,
    );

    const labelIdx = Math.round((i / spec.tickCount) * Math.max(0, spec.tickLabels.length - 1));
    if (major && spec.tickLabels[labelIdx] && r > 22) {
      const lr = inner - band * 0.42;
      const lx = cx + Math.cos(ang) * lr;
      const ly = cy + Math.sin(ang) * lr;
      ticks.push(
        <text
          key={`l${i}`}
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(5, r * 0.095)}
          fill="#e8c872"
          fontFamily="Georgia, serif"
          fontWeight={600}
          opacity={0.9}
        >
          {spec.tickLabels[labelIdx]}
        </text>,
      );
    }
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
          <stop offset="0%" stopColor="#e8c872" stopOpacity={glass ? 0.7 : 1} />
          <stop offset="50%" stopColor={spec.color} stopOpacity={glass ? 0.65 : 0.95} />
          <stop offset="100%" stopColor="#5a4a22" stopOpacity={glass ? 0.6 : 1} />
        </linearGradient>
      </defs>

      {/* rotating dial — current value spins to north (12 o'clock) */}
      <g transform={`rotate(${dialSpin} ${cx} ${cy})`}>
        <path d={arcPath} fill="none" stroke={`url(#br-${uid})`} strokeWidth={band} strokeLinecap="round" />
        <path d={arcPath} fill="none" stroke="#0a0806" strokeWidth={band - 2} strokeLinecap="round" opacity={glass ? 0.25 : 0.5} />
        {ticks}
      </g>

      {/* fixed "now" notch at top of this ring */}
      <line
        x1={cx}
        y1={cy - inner + 1}
        x2={cx}
        y2={cy - r - 1}
        stroke="#f0d060"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.95}
      />
    </g>
  );
}

function clockTickLabels(clockId: string): { labels: string[]; count: number } {
  switch (clockId) {
    case "ms": return { labels: ["0", "250", "500", "750"], count: 10 };
    case "s": return { labels: ["0", "15", "30", "45"], count: 12 };
    case "min": return { labels: ["0", "15", "30", "45"], count: 12 };
    case "h": return { labels: ["12", "3", "6", "9"], count: 12 };
    default: return { labels: [], count: 8 };
  }
}

function calendarTickLabels(_w: CalendarWheel): { labels: string[]; count: number } {
  return { labels: [], count: 8 };
}

export function WatchMovement({
  animMs,
  now,
  weather,
  calendarWheels,
  hoverId,
  onHover,
  glass = false,
  heading = 0,
  emfUt = null,
  showCompass = true,
}: WatchMovementProps) {
  const cx = 200;
  const cy = 198;

  const rings: RingSpec[] = [];
  const hubR = 24;
  let ri = 0;

  const addRing = (spec: Omit<RingSpec, "radius"> & { radius?: number }) => {
    rings.push({
      ...spec,
      radius: spec.radius ?? hubR + 14 + ri * 11,
    });
    ri++;
  };

  CLOCK_IDS.forEach((id) => {
    const { labels, count } = clockTickLabels(id);
    addRing({
      id,
      color: CLOCK_META[id].color,
      nowAngle: ringAngle(id, now),
      tickLabels: labels,
      tickCount: count,
    });
  });

  if (weather) {
    addRing({
      id: "weather",
      color: "#22d3ee",
      nowAngle: cycleAngle(1, now),
      tickLabels: weather.tempC != null ? [`${Math.round(weather.tempC)}°`, "—", "—", "—"] : ["—", "—", "—", "—"],
      tickCount: 8,
    });
  }

  calendarWheels.forEach((w) => {
    const { labels, count } = calendarTickLabels(w);
    addRing({
      id: w.id,
      color: w.color,
      nowAngle: cycleAngle(w.periodDays, now),
      tickLabels: labels,
      tickCount: count,
    });
  });

  return (
    <svg
      viewBox="0 0 400 210"
      className={`cp-watch-movement${glass ? " cp-watch-movement-glass" : ""}`}
      role="img"
      aria-label="Cycle wheels watch movement"
    >
      {!glass && (
        <>
          <defs>
            <radialGradient id="watch-bg" cx="50%" cy="95%" r="75%">
              <stop offset="0%" stopColor="#2a2218" />
              <stop offset="55%" stopColor="#12100c" />
              <stop offset="100%" stopColor="#080604" />
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={400} height={210} fill="url(#watch-bg)" rx={8} />
        </>
      )}

      {/* outer rings first (paint order: inside on top) */}
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

      {/* center compass + EMF */}
      <HubCompass
        cx={cx}
        cy={cy}
        heading={heading}
        emfUt={emfUt}
        showCompass={showCompass}
        glass={glass}
      />
    </svg>
  );
}
