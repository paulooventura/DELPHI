"use client";

import { useId } from "react";

export type SteampunkWheelRingProps = {
  size: number;
  color: string;
  angleDeg?: number;
  periodS?: number;
  offsetS?: number;
  icon?: string;
  value?: string | number;
  name?: string;
  fullLabel?: string;
  /** Short unit label on clock dials (ms, sec, …) */
  unit?: string;
  /** Number of tick marks around the dial */
  tickCount?: number;
  /** Labels placed on major ticks (evenly distributed) */
  tickLabels?: string[];
  active?: boolean;
  onHover?: (on: boolean) => void;
};

function brassGradient(id: string, accent: string) {
  return (
    <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#e8c872" />
      <stop offset="35%" stopColor={accent} />
      <stop offset="70%" stopColor="#8b6914" />
      <stop offset="100%" stopColor="#4a3a12" />
    </linearGradient>
  );
}

function GearTeeth({
  cx,
  cy,
  outerR,
  innerR,
  teeth,
  fill,
}: {
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  teeth: number;
  fill: string;
}) {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step - Math.PI / 2;
    const a1 = a0 + step * 0.38;
    const a2 = a0 + step * 0.5;
    const a3 = a0 + step * 0.62;
    const p = (a: number, r: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
    const [x0, y0] = p(a0, innerR);
    const [x1, y1] = p(a1, outerR);
    const [x2, y2] = p(a2, outerR);
    const [x3, y3] = p(a3, innerR);
    pts.push(`${i === 0 ? "M" : "L"}${x0.toFixed(2)},${y0.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)}`);
  }
  return <path d={`${pts.join(" ")} Z`} fill={fill} opacity={0.92} />;
}

function DialTicks({
  cx,
  cy,
  r,
  count,
  accent,
  tickLabels,
}: {
  cx: number;
  cy: number;
  r: number;
  count: number;
  accent: string;
  tickLabels?: string[];
}) {
  const items = [];
  const labelStep = tickLabels ? Math.max(1, Math.floor(count / tickLabels.length)) : Math.max(1, Math.floor(count / 4));
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * 360 - 90;
    const rad = (ang * Math.PI) / 180;
    const major = i % labelStep === 0;
    const len = major ? r * 0.11 : r * 0.06;
    const x1 = cx + Math.cos(rad) * (r - len - 2);
    const y1 = cy + Math.sin(rad) * (r - len - 2);
    const x2 = cx + Math.cos(rad) * (r - 2);
    const y2 = cy + Math.sin(rad) * (r - 2);
    items.push(
      <line
        key={`t${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={major ? accent : "#6b5a3a"}
        strokeWidth={major ? 1.4 : 0.8}
        strokeLinecap="round"
      />,
    );
    const label = tickLabels?.[Math.floor((i / count) * tickLabels.length) % tickLabels.length];
    if (label && major) {
      const lr = r * 0.66;
      items.push(
        <text
          key={`l${i}`}
          x={cx + Math.cos(rad) * lr}
          y={cy + Math.sin(rad) * lr}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(5.5, r * 0.1)}
          fill="#c9b070"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight={700}
        >
          {label}
        </text>,
      );
    }
  }
  return <g>{items}</g>;
}

export function SteampunkWheelRing({
  size,
  color,
  angleDeg,
  periodS,
  offsetS,
  icon,
  value,
  name,
  fullLabel,
  unit,
  tickCount = 12,
  tickLabels,
  active,
  onHover,
}: SteampunkWheelRingProps) {
  const uid = useId().replace(/:/g, "");
  const isAnim = periodS != null;
  const r = size / 2;
  const cx = r;
  const cy = r;
  const brassId = `brass-${uid}`;
  const faceId = `face-${uid}`;
  const teeth = Math.max(16, Math.min(36, Math.round(size / 3.5)));

  const dialStyle: React.CSSProperties = isAnim
    ? {
        animationName: "steam-dial-spin",
        animationDuration: `${periodS}s`,
        animationDelay: `-${offsetS ?? 0}s`,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
        animationFillMode: "both",
      }
    : {
        transform: `rotate(${angleDeg ?? 0}deg)`,
      };

  const wrapStyle: React.CSSProperties = {
    width: size,
    height: size,
    transform: "translate(-50%, -50%)",
  };

  const gaugeCounter = isAnim ? 0 : -(angleDeg ?? 0);
  const showGauge = icon != null || value != null || unit != null;

  return (
    <div className="cp-ring-anchor">
      <div
        className={`cp-steam-ring-wrap${active ? " cp-ring-active" : ""}`}
        style={wrapStyle}
        onMouseEnter={onHover ? () => onHover(true) : undefined}
        onMouseLeave={onHover ? () => onHover(false) : undefined}
      >
        <div className="cp-steam-dial" style={dialStyle}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
            <defs>
              {brassGradient(brassId, color)}
              <radialGradient id={faceId} cx="38%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#3d3428" />
                <stop offset="55%" stopColor="#1a1510" />
                <stop offset="100%" stopColor="#0d0a08" />
              </radialGradient>
            </defs>

            <GearTeeth cx={cx} cy={cy} outerR={r - 1} innerR={r - 5} teeth={teeth} fill={`url(#${brassId})`} />

            <circle cx={cx} cy={cy} r={r - 6} fill={`url(#${faceId})`} stroke="#5a4a2a" strokeWidth={1.2} />

            <circle cx={cx} cy={cy} r={r - 9} fill="none" stroke="#8b6914" strokeWidth={0.8} opacity={0.55} />
            <circle cx={cx} cy={cy} r={r * 0.58} fill="none" stroke="#6b5a3a" strokeWidth={0.6} strokeDasharray="3 2.5" opacity={0.7} />

            <DialTicks cx={cx} cy={cy} r={r - 7} count={tickCount} accent={color} tickLabels={tickLabels} />

            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = ((deg - 90) * Math.PI) / 180;
              const rr = r - 10;
              return (
                <g key={deg}>
                  <circle
                    cx={cx + Math.cos(rad) * rr}
                    cy={cy + Math.sin(rad) * rr}
                    r={1.6}
                    fill="#2a2218"
                    stroke="#c9a227"
                    strokeWidth={0.6}
                  />
                  <circle
                    cx={cx + Math.cos(rad) * rr}
                    cy={cy + Math.sin(rad) * rr}
                    r={0.45}
                    fill="#e8c872"
                  />
                </g>
              );
            })}

            {/* spoke hints */}
            {[0, 120, 240].map((deg) => {
              const rad = ((deg - 90) * Math.PI) / 180;
              return (
                <line
                  key={`sp${deg}`}
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(rad) * (r * 0.52)}
                  y2={cy + Math.sin(rad) * (r * 0.52)}
                  stroke="#4a3a22"
                  strokeWidth={0.7}
                  opacity={0.65}
                />
              );
            })}

            <circle cx={cx} cy={cy} r={Math.max(4, size * 0.07)} fill="#1a1510" stroke={`url(#${brassId})`} strokeWidth={1.4} />
            <circle cx={cx} cy={cy} r={Math.max(2, size * 0.028)} fill={color} opacity={0.85} />
          </svg>
        </div>

        {showGauge && (
          <div
            className={`cp-steam-gauge${active ? " cp-steam-gauge-active" : ""}`}
            style={{ transform: `translateX(-50%) rotate(${gaugeCounter}deg)` }}
          >
            <div className="cp-steam-needle" style={{ background: color }} />
            <div className="cp-steam-gauge-plate" style={{ borderColor: color }}>
              <span className="cp-steam-gauge-screw cp-steam-gauge-screw-l" />
              <span className="cp-steam-gauge-screw cp-steam-gauge-screw-r" />
              {icon && <span className="cp-steam-gauge-icon">{icon}</span>}
              {value != null && <span className="cp-steam-gauge-val">{value}</span>}
              {unit && <span className="cp-steam-gauge-unit">{unit}</span>}
            </div>
          </div>
        )}

        {active && fullLabel && (
          <div className="cp-steam-tooltip" style={{ transform: `translateX(-50%) rotate(${gaugeCounter}deg)` }}>
            {name ? `${name}: ` : ""}{fullLabel}
          </div>
        )}
      </div>
    </div>
  );
}
