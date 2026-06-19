"use client";

import { useId } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";

export type CalendarWheel = CycleSnapshot["wheelLayers"][number];
export type GregorianInfo = CycleSnapshot["gregorian"];

export type WatchMovementProps = {
  now: Date;
  gregorian: GregorianInfo | null;
  weather: CycleSnapshot["weather"] | null;
  calendarWheels: CalendarWheel[];
  hoverId: string | null;
  onHover: (id: string | null) => void;
  glass?: boolean;
  heading?: number;
  emfUt?: number | null;
  showCompass?: boolean;
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

function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
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
    ? Math.max(3.2, Math.min(band * 0.78, (360 / spec.divisions) * 0.22))
    : Math.max(4.5, band * 0.55);

  const ticks = [];
  for (let i = 0; i < spec.divisions; i++) {
    const ang = tickRad(i, spec.divisions);
    const major = i % spec.labelEvery === 0;
    const tickLen = major ? band * 0.55 : band * 0.3;
    const tInner = midR - tickLen / 2;
    const tOuter = midR + tickLen / 2;

    ticks.push(
      <line
        key={`t${i}`}
        x1={cx + Math.cos(ang) * tInner}
        y1={cy + Math.sin(ang) * tInner}
        x2={cx + Math.cos(ang) * tOuter}
        y2={cy + Math.sin(ang) * tOuter}
        stroke={major ? spec.color : "#5a4a32"}
        strokeWidth={major ? 0.9 : 0.45}
        strokeLinecap="round"
        opacity={major ? 0.95 : 0.5}
      />,
    );

    if (major) {
      let txt: string | null = null;
      if (spec.customLabel) {
        txt = spec.customLabel(i, spec.divisions);
      } else {
        const val = i;
        txt = spec.labelPad != null ? String(val).padStart(spec.labelPad, "0") : String(val);
      }

      if (txt) {
        const lx = cx + Math.cos(ang) * midR;
        const ly = cy + Math.sin(ang) * midR;
        const rot = (ang * 180) / Math.PI + 90;
        ticks.push(
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
        <g clipPath={`url(#clip-${uid})`}>{ticks}</g>
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
  gregorian,
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
  const cy = 200;
  const hubR = 26;
  const rings: RingSpec[] = [];
  let ri = 0;

  const TIME_IDS = new Set(["ms", "s", "min", "h"]);

  const addRing = (spec: Omit<RingSpec, "radius">) => {
    const step = TIME_IDS.has(spec.id) ? 10 : 7;
    rings.push({ ...spec, radius: hubR + 12 + ri * step });
    ri++;
  };

  addRing({
    id: "ms",
    color: "#fbbf24",
    nowAngle: msAngle(now),
    divisions: 100,
    labelEvery: 10,
    labelPad: 2,
    dense: true,
  });

  addRing({
    id: "s",
    color: "#f97316",
    nowAngle: secAngle(now),
    divisions: 60,
    labelEvery: 1,
    labelPad: 0,
    dense: true,
  });

  addRing({
    id: "min",
    color: "#ef4444",
    nowAngle: minAngle(now),
    divisions: 60,
    labelEvery: 1,
    labelPad: 0,
    dense: true,
  });

  addRing({
    id: "h",
    color: "#d946ef",
    nowAngle: hourAngle(now),
    divisions: 24,
    labelEvery: 1,
    labelPad: 0,
    dense: true,
  });

  if (gregorian) {
    const dim = daysInMonth(gregorian.year, gregorian.monthNum);
    const weekdayIdx = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(gregorian.weekday);
    const wd = weekdayIdx >= 0 ? weekdayIdx : now.getDay();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    addRing({
      id: "weekday",
      color: "#94a3b8",
      nowAngle: (wd / 7) * 360,
      divisions: 7,
      labelEvery: 1,
      customLabel: i => weekdays[i] ?? null,
    });

    addRing({
      id: "month",
      color: "#a78bfa",
      nowAngle: ((gregorian.monthNum - 1 + (gregorian.day - 1) / dim) / 12) * 360,
      divisions: 12,
      labelEvery: 1,
      customLabel: i => months[i] ?? null,
    });

    addRing({
      id: "day",
      color: "#c084fc",
      nowAngle: ((gregorian.day - 1 + now.getHours() / 24) / dim) * 360,
      divisions: dim,
      labelEvery: Math.max(1, Math.floor(dim / 6)),
      labelPad: 0,
    });

    addRing({
      id: "year",
      color: "#818cf8",
      nowAngle: (gregorian.dayOfYear / 365) * 360,
      divisions: 4,
      labelEvery: 1,
      customLabel: i => (i === 0 ? String(gregorian.year) : null),
    });

    addRing({
      id: "week",
      color: "#60a5fa",
      nowAngle: (gregorian.weekOfYear / 52) * 360,
      divisions: 52,
      labelEvery: 13,
      customLabel: i => `W${i}`,
    });

    addRing({
      id: "doy",
      color: "#38bdf8",
      nowAngle: (gregorian.dayOfYear / 365) * 360,
      divisions: 4,
      labelEvery: 1,
      customLabel: i => ["D1", "D91", "D182", "D273"][i] ?? null,
    });
  }

  if (weather) {
    addRing({
      id: "weather",
      color: "#22d3ee",
      nowAngle: cycleAngle(1, now),
      divisions: 8,
      labelEvery: 4,
      customLabel: i => (i === 0 && weather.tempC != null ? `${Math.round(weather.tempC)}°` : i === 0 ? "—" : null),
    });
  }

  calendarWheels.forEach((w) => {
    const subNum = w.sublabel.match(/\d+/)?.[0];
    addRing({
      id: w.id,
      color: w.color,
      nowAngle: cycleAngle(w.periodDays, now),
      divisions: 8,
      labelEvery: 4,
      customLabel: i => (i === 0 ? subNum ?? null : null),
    });
  });

  return (
    <svg
      viewBox="0 0 400 400"
      className={`cp-watch-movement${glass ? " cp-watch-movement-glass" : ""}`}
      role="img"
      aria-label="Cycle wheels watch movement"
    >
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
    </svg>
  );
}
