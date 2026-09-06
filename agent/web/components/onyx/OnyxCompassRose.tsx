"use client";

/**
 * Glossy compass bezel around the home taijitu.
 *
 * Geographic dial (N/E/S/W + ticks) rotates from device heading so aiming
 * the phone north brings N under the fixed lubber line at the top.
 * Rotation is CSS on a nested svg (fill-box, 50% 50%) — WebKit promotes
 * SVG rotate(θ cx cy) to CSS and then applies a device-pixel origin, which
 * made the ring orbit off the marble.
 */

import { useId, useMemo } from "react";

export type CompassRoseDir = "up" | "down" | "left" | "right";

const GEO_CARDINALS: { letter: string; angle: number }[] = [
  { letter: "N", angle: 0 },
  { letter: "E", angle: 90 },
  { letter: "S", angle: 180 },
  { letter: "W", angle: 270 },
];

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Short label for the direction the phone is facing. */
export function facingCardinal(headingDeg: number): string {
  const h = normalizeHeading(headingDeg);
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  return names[Math.round(h / 45) % 8]!;
}

export function OnyxCompassRose({
  active = null,
  follow = { x: 0, y: 0 },
  holding = false,
  headingDeg = null,
}: {
  active?: CompassRoseDir | "center" | null;
  follow?: { x: number; y: number };
  holding?: boolean;
  /** Device look azimuth in degrees — 0 = geographic north, clockwise. */
  headingDeg?: number | null;
}) {
  const uid = useId().replace(/:/g, "");
  const lit: CompassRoseDir | null =
    active === "up" || active === "down" || active === "left" || active === "right"
      ? active
      : null;

  const live = headingDeg != null && Number.isFinite(headingDeg);
  const heading = live ? normalizeHeading(headingDeg!) : 0;
  // Dial rotates opposite the phone turn so world-north stays world-north.
  const dialDeg = live ? -heading : 0;

  const dist = Math.hypot(follow.x, follow.y);
  const dragNeedleDeg =
    dist > 2 ? (Math.atan2(follow.x, -follow.y) * 180) / Math.PI : 0;
  const dragOn = holding && dist > 6;

  const ticks = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const a = (i * 10 * Math.PI) / 180;
        const major = i % 3 === 0;
        const r0 = major ? 42.2 : 43.6;
        const r1 = 45.4;
        return {
          i,
          major,
          x0: 50 + r0 * Math.sin(a),
          y0: 50 - r0 * Math.cos(a),
          x1: 50 + r1 * Math.sin(a),
          y1: 50 - r1 * Math.cos(a),
        };
      }),
    [],
  );

  return (
    <svg
      className={`onyx-compass-rose${holding ? " holding" : ""}${lit ? " aiming" : ""}${live ? " live" : " idle"}`}
      viewBox="0 0 100 100"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-bezel`} x1="18%" y1="8%" x2="82%" y2="92%">
          <stop offset="0%" stopColor="#e8e0ff" stopOpacity="0.72" />
          <stop offset="28%" stopColor="#8a7bff" stopOpacity="0.55" />
          <stop offset="58%" stopColor="#2a1a48" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c8b8ff" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f4f0ff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#6c5cff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0a0614" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id={`${uid}-glass`} cx="38%" cy="28%" r="68%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="42%" stopColor="#a99cff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-well`} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fixed outer bezel (does not rotate) */}
      <circle
        cx="50"
        cy="50"
        r="49.2"
        fill="none"
        stroke={`url(#${uid}-bezel)`}
        strokeWidth="1.6"
      />
      <circle
        cx="50"
        cy="50"
        r="46.4"
        fill={`url(#${uid}-well)`}
        stroke={`url(#${uid}-rim)`}
        strokeWidth="0.7"
      />
      <circle cx="50" cy="50" r="46" fill={`url(#${uid}-glass)`} />

      {/* Nested svg so fill-box origin is the marble, not a 50px device origin. */}
      <svg
        className="onyx-compass-dial"
        x="0"
        y="0"
        width="100"
        height="100"
        viewBox="0 0 100 100"
        overflow="visible"
        style={{
          transform: `rotate(${dialDeg}deg)`,
          transformOrigin: "50% 50%",
          transformBox: "fill-box",
        }}
      >
        {ticks.map(t => (
          <line
            key={t.i}
            x1={t.x0}
            y1={t.y0}
            x2={t.x1}
            y2={t.y1}
            stroke={t.major ? "rgba(232,224,255,0.55)" : "rgba(160,148,220,0.28)"}
            strokeWidth={t.major ? 0.55 : 0.3}
          />
        ))}

        {GEO_CARDINALS.map(({ letter, angle }) => {
          const rad = (angle * Math.PI) / 180;
          const lx = 50 + 38.8 * Math.sin(rad);
          const ly = 50 - 38.8 * Math.cos(rad);
          const isN = letter === "N";
          return (
            <text
              key={letter}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className={`onyx-compass-letter${isN ? " north" : ""}`}
              fill={isN ? "#ff6b6b" : "rgba(210,200,240,0.78)"}
            >
              {letter}
            </text>
          );
        })}

        <path
          d="M 50 16.2 L 51.4 20.4 L 48.6 20.4 Z"
          fill="#ff6b6b"
          opacity={live ? 0.95 : 0.4}
        />
      </svg>

      {/* Inner aperture framing the marble */}
      <circle
        cx="50"
        cy="50"
        r="31.2"
        fill="none"
        stroke="rgba(200,188,255,0.28)"
        strokeWidth="0.55"
      />
      <circle
        cx="50"
        cy="50"
        r="30.2"
        fill="none"
        stroke="rgba(8,6,16,0.65)"
        strokeWidth="1.1"
      />

      {/* Fixed lubber line — top of the phone = direction you face */}
      <g className="onyx-compass-lubber">
        <path
          d="M 50 3.2 L 52.6 8.6 L 47.4 8.6 Z"
          fill="#f4f0ff"
          filter={`url(#${uid}-glow)`}
        />
        <line
          x1="50"
          y1="8.8"
          x2="50"
          y2="14.5"
          stroke="rgba(244,240,255,0.55)"
          strokeWidth="0.55"
        />
      </g>

      {/* Door-aim wedge (screen-fixed) */}
      {lit && (
        <path
          className="onyx-compass-wedge"
          d={wedgePath(lit)}
          fill="rgba(169,156,255,0.16)"
          stroke="rgba(200,188,255,0.5)"
          strokeWidth="0.4"
          filter={`url(#${uid}-glow)`}
        />
      )}

      {/* Drag needle — only while holding for a door */}
      <g
        className={`onyx-compass-needle${dragOn ? " on" : ""}`}
        transform={`rotate(${dragNeedleDeg.toFixed(1)} 50 50)`}
        opacity={dragOn ? 1 : 0}
      >
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="18.5"
          stroke="#f2eeff"
          strokeWidth="0.7"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
        />
        <circle cx="50" cy="18.2" r="1.2" fill="#fff" />
      </g>

      <circle
        cx="50"
        cy="50"
        r="1.8"
        fill="#1a1228"
        stroke="rgba(220,210,255,0.55)"
        strokeWidth="0.45"
      />
      <circle cx="50" cy="50" r="0.7" fill="#e8e0ff" />
    </svg>
  );
}

function wedgePath(dir: CompassRoseDir): string {
  const center = { up: -90, right: 0, down: 90, left: 180 }[dir];
  const a0 = ((center - 18) * Math.PI) / 180;
  const a1 = ((center + 18) * Math.PI) / 180;
  const r0 = 31.4;
  const r1 = 45.2;
  const p = (r: number, a: number) => `${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}
