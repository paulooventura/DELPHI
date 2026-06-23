"use client";

import { useEffect, useRef } from "react";

export type SensesSpeedDialProps = {
  /** Ground speed m/s (GPS). */
  speedMps: number | null;
  /** Linear g-force from accelerometer. */
  gForce: number | null;
  /** Step cadence steps per minute. */
  cadenceSpm: number | null;
  /** Heading degrees. */
  headingDeg: number | null;
  live?: boolean;
};

const MAX_SPEED_KMH = 160;
const MAX_G = 2.5;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function SensesSpeedDial({
  speedMps,
  gForce,
  cadenceSpm,
  headingDeg,
  live = false,
}: SensesSpeedDialProps) {
  const needleRef = useRef<SVGLineElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);

  const speedKmh = speedMps != null && Number.isFinite(speedMps) ? speedMps * 3.6 : null;
  const primary = speedKmh != null && speedKmh > 0.5 ? speedKmh : (gForce ?? 0) * 12;
  const max = speedKmh != null && speedKmh > 0.5 ? MAX_SPEED_KMH : MAX_G * 12;
  const unit = speedKmh != null && speedKmh > 0.5 ? "km/h" : "activity";
  const pct = clamp01(primary / max);
  const angle = -135 + pct * 270;

  useEffect(() => {
    const needle = needleRef.current;
    const glow = glowRef.current;
    if (needle) needle.style.transform = `rotate(${angle}deg)`;
    if (glow) glow.style.opacity = String(0.35 + pct * 0.45);
  }, [angle, pct]);

  const display =
    speedKmh != null && speedKmh > 0.5
      ? Math.round(speedKmh).toString()
      : gForce != null
        ? gForce.toFixed(2)
        : "—";

  return (
    <div className="cp-speed-dial" aria-label="Motion speed dial">
      <svg viewBox="0 0 220 140" className="cp-speed-dial-svg" aria-hidden>
        <defs>
          <linearGradient id="cp-dial-arc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="45%" stopColor="#c9a227" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
          <filter id="cp-dial-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M 28 118 A 82 82 0 0 1 192 118"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 28 118 A 82 82 0 0 1 192 118"
          fill="none"
          stroke="url(#cp-dial-arc)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${pct * 258} 258`}
        />
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const a = (-135 + t * 270) * (Math.PI / 180);
          const cx = 110;
          const cy = 118;
          const r0 = 68;
          const r1 = 76;
          return (
            <line
              key={t}
              x1={cx + Math.cos(a) * r0}
              y1={cy + Math.sin(a) * r0}
              x2={cx + Math.cos(a) * r1}
              y2={cy + Math.sin(a) * r1}
              stroke="rgba(201,162,39,0.45)"
              strokeWidth={t === 0.5 ? 2 : 1}
            />
          );
        })}
        <circle ref={glowRef} cx={110} cy={118} r={52} fill="rgba(201,162,39,0.2)" filter="url(#cp-dial-glow)" />
        <g transform="translate(110 118)">
          <line
            ref={needleRef}
            x1={0}
            y1={8}
            x2={0}
            y2={-58}
            stroke="#f5d78e"
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ transformOrigin: "0px 0px", transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
          <circle r={5} fill="#0d111a" stroke="#c9a227" strokeWidth={2} />
        </g>
      </svg>
      <div className="cp-speed-dial-readout">
        <span className="cp-speed-dial-value">{display}</span>
        <span className="cp-speed-dial-unit">{unit}</span>
        <span className="cp-speed-dial-sub">
          {cadenceSpm != null && cadenceSpm > 0 ? `${Math.round(cadenceSpm)} spm` : ""}
          {headingDeg != null ? ` · ${Math.round(headingDeg)}°` : ""}
          {live ? " · live" : ""}
        </span>
      </div>
    </div>
  );
}
