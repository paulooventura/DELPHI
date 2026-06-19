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
};

const CLOCK_IDS = ["ms", "s", "min", "h"] as const;
const CLOCK_META: Record<(typeof CLOCK_IDS)[number], { color: string; icon: string; unit: string }> = {
  ms:  { color: "#fbbf24", icon: "⚙", unit: "MS" },
  s:   { color: "#f97316", icon: "◷", unit: "SEC" },
  min: { color: "#ef4444", icon: "⏱", unit: "MIN" },
  h:   { color: "#d946ef", icon: "🕰", unit: "HR" },
};

function watchHandAngle(clockId: string, d: Date): number {
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

function cycleHandAngle(periodDays: number, d: Date): number {
  if (periodDays <= 0) return 0;
  // Boost calendar complications so motion is visible (real rates are days/months/years)
  const boost = 180;
  const periodMs = (periodDays * 86400000) / boost;
  return ((d.getTime() % periodMs) / periodMs) * 360;
}

function clockValue(clockId: string, d: Date): string {
  switch (clockId) {
    case "ms": return String(d.getMilliseconds()).padStart(3, "0");
    case "s": return String(d.getSeconds()).padStart(2, "0");
    case "min": return String(d.getMinutes()).padStart(2, "0");
    case "h": return String(d.getHours()).padStart(2, "0");
    default: return "";
  }
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
  handAngle: number;
  label: string;
  icon: string;
  unit: string;
  isClock: boolean;
};

function SemicircleRing({
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
  const band = Math.max(5, r * 0.09);
  const inner = r - band;

  // Semicircle arc (left to right over the top)
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const ticks = [];
  for (let i = 0; i <= 12; i++) {
    const ang = Math.PI + (i / 12) * Math.PI;
    const major = i % 3 === 0;
    const len = major ? band * 0.85 : band * 0.45;
    ticks.push(
      <line
        key={i}
        x1={cx + Math.cos(ang) * inner}
        y1={cy + Math.sin(ang) * inner}
        x2={cx + Math.cos(ang) * (r - 1)}
        y2={cy + Math.sin(ang) * (r - 1)}
        stroke={major ? spec.color : "#6b5a3a"}
        strokeWidth={major ? 1.3 : 0.7}
        strokeLinecap="round"
      />,
    );
    if (major && r > 24) {
      const lr = inner - band * 0.55;
      const lx = cx + Math.cos(ang) * lr;
      const ly = cy + Math.sin(ang) * lr;
      const labelAt: Record<number, string> = { 0: "9", 6: "12", 12: "3" };
      const txt = labelAt[i];
      if (txt) {
        ticks.push(
          <text
            key={`n${i}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(6, r * 0.11)}
            fill="#c9b070"
            fontFamily="Georgia, serif"
            fontWeight={700}
          >
            {txt}
          </text>,
        );
      }
    }
  }

  const handRad = ((spec.handAngle - 90) * Math.PI) / 180;
  const handLen = inner - 4;
  const hx = cx + Math.cos(handRad) * handLen;
  const hy = cy + Math.sin(handRad) * handLen;
  const labelY = cy - r + band * 0.35;

  const ringOpacity = glass ? 0.58 : 1;
  const plateFill = glass ? "rgba(14, 17, 32, 0.72)" : "#1a1510";

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
          <stop offset="0%" stopColor="#e8c872" />
          <stop offset="50%" stopColor={spec.color} />
          <stop offset="100%" stopColor="#5a4a22" />
        </linearGradient>
      </defs>

      {/* brass band */}
      <path d={arcPath} fill="none" stroke={`url(#br-${uid})`} strokeWidth={band} strokeLinecap="round" opacity={glass ? 0.75 : 1} />
      <path d={arcPath} fill="none" stroke="#1a1510" strokeWidth={band - 2.5} strokeLinecap="round" opacity={glass ? 0.35 : 0.85} />

      {ticks}

      {/* hand */}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={spec.color} strokeWidth={Math.max(1.2, r * 0.025)} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={Math.max(1.5, r * 0.025)} fill={spec.color} />
      <circle cx={cx} cy={cy} r={Math.max(2.5, r * 0.045)} fill="#1a1510" stroke="#c9a227" strokeWidth={0.8} />

      {/* readout plate at top of ring */}
      <g transform={`translate(${cx}, ${labelY})`} opacity={glass ? 0.92 : 1}>
        <rect x={-22} y={-8} width={44} height={14} rx={2} fill={plateFill} stroke={spec.color} strokeWidth={1} />
        <text x={-16} y={2} fontSize={8} textAnchor="middle">{spec.icon}</text>
        <text x={2} y={2} fontSize={8} fill="#e8c872" fontWeight={700} textAnchor="middle" fontFamily="Georgia, serif">{spec.label}</text>
        <text x={16} y={2} fontSize={6} fill="#8b7355" textAnchor="middle">{spec.unit}</text>
      </g>
    </g>
  );
}

export function WatchMovement({ animMs, now, weather, calendarWheels, hoverId, onHover, glass = false }: WatchMovementProps) {
  const cx = 200;
  const cy = 198;
  const hubSpin = ((animMs / 1000) / 8) * 360;

  const rings: RingSpec[] = [];

  CLOCK_IDS.forEach((id, i) => {
    rings.push({
      id,
      radius: 28 + i * 10,
      color: CLOCK_META[id].color,
      handAngle: watchHandAngle(id, now),
      label: clockValue(id, now),
      icon: CLOCK_META[id].icon,
      unit: CLOCK_META[id].unit,
      isClock: true,
    });
  });

  const clockCount = CLOCK_IDS.length;
  let idx = 0;

  if (weather) {
    rings.push({
      id: "weather",
      radius: 28 + (clockCount + idx) * 10,
      color: "#22d3ee",
      handAngle: cycleHandAngle(1, now),
      label: weather.tempC != null ? `${Math.round(weather.tempC)}°` : "—",
      icon: weather.emoji,
      unit: "WX",
      isClock: false,
    });
    idx++;
  }

  calendarWheels.forEach((w) => {
    rings.push({
      id: w.id,
      radius: 28 + (clockCount + idx) * 10,
      color: w.color,
      handAngle: cycleHandAngle(w.periodDays, now),
      label: compactVal(w),
      icon: w.icon,
      unit: w.name.slice(0, 3).toUpperCase(),
      isClock: false,
    });
    idx++;
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

      {/* base plate screws */}
      {[80, 200, 320].map((x) => (
        <circle key={x} cx={x} cy={196} r={2.5} fill="#1a1510" stroke="#8b6914" strokeWidth={0.6} opacity={glass ? 0.45 : 1} />
      ))}

      {rings.map((spec) => (
        <SemicircleRing
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

      {/* central hub + meshing pinions */}
      <g transform={`rotate(${hubSpin} ${cx} ${cy})`} opacity={glass ? 0.62 : 1}>
        {[0, 120, 240].map((d) => {
          const rad = ((d - 90) * Math.PI) / 180;
          return (
            <line key={d} x1={cx} y1={cy} x2={cx + Math.cos(rad) * 14} y2={cy + Math.sin(rad) * 14} stroke="#8b6914" strokeWidth={1.2} />
          );
        })}
        <circle cx={cx} cy={cy} r={10} fill="#1a1510" stroke="#c9a227" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={4} fill="#c9a227" />
      </g>

      <g transform={`rotate(${-hubSpin * 1.4} ${cx + 22} ${cy - 6})`} opacity={glass ? 0.62 : 1}>
        <circle cx={cx + 22} cy={cy - 6} r={7} fill="#2a2218" stroke="#b8860b" strokeWidth={1} />
        {[0, 90, 180, 270].map((d) => {
          const rad = ((d - 90) * Math.PI) / 180;
          return (
            <line key={d} x1={cx + 22} y1={cy - 6} x2={cx + 22 + Math.cos(rad) * 5} y2={cy - 6 + Math.sin(rad) * 5} stroke="#c9a227" strokeWidth={0.8} />
          );
        })}
      </g>
    </svg>
  );
}
