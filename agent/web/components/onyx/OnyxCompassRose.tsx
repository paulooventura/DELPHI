"use client";

/**
 * Glossy compass bezel that envelops the home taijitu.
 * Needle tracks the drag vector; cardinals light when a door is aimed.
 */

export type CompassRoseDir = "up" | "down" | "left" | "right";

const CARDINALS: {
  dir: CompassRoseDir;
  letter: string;
  label: string;
  angle: number;
}[] = [
  { dir: "up", letter: "N", label: "sky", angle: 0 },
  { dir: "right", letter: "E", label: "orrery", angle: 90 },
  { dir: "down", letter: "S", label: "tonal", angle: 180 },
  { dir: "left", letter: "W", label: "studies", angle: 270 },
];

export function OnyxCompassRose({
  active = null,
  follow = { x: 0, y: 0 },
  holding = false,
}: {
  active?: CompassRoseDir | "center" | null;
  follow?: { x: number; y: number };
  holding?: boolean;
}) {
  const lit: CompassRoseDir | null =
    active === "up" || active === "down" || active === "left" || active === "right"
      ? active
      : null;

  const dist = Math.hypot(follow.x, follow.y);
  // 0° = up (N). Follows pointer even before a cardinal locks.
  const needleDeg =
    dist > 2 ? (Math.atan2(follow.x, -follow.y) * 180) / Math.PI : 0;
  const needleOn = holding && dist > 6;

  return (
    <svg
      className={`onyx-compass-rose${holding ? " holding" : ""}${lit ? " aiming" : ""}`}
      viewBox="0 0 100 100"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="ocr-bezel" x1="18%" y1="8%" x2="82%" y2="92%">
          <stop offset="0%" stopColor="#e8e0ff" stopOpacity="0.72" />
          <stop offset="28%" stopColor="#8a7bff" stopOpacity="0.55" />
          <stop offset="58%" stopColor="#2a1a48" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c8b8ff" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id="ocr-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f4f0ff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#6c5cff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0a0614" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="ocr-glass" cx="38%" cy="28%" r="68%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="42%" stopColor="#a99cff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ocr-well" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </radialGradient>
        <filter id="ocr-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer bezel */}
      <circle
        cx="50"
        cy="50"
        r="49.2"
        fill="none"
        stroke="url(#ocr-bezel)"
        strokeWidth="1.6"
      />
      <circle
        cx="50"
        cy="50"
        r="46.4"
        fill="url(#ocr-well)"
        stroke="url(#ocr-rim)"
        strokeWidth="0.7"
      />
      <circle cx="50" cy="50" r="46" fill="url(#ocr-glass)" />

      {/* Tick marks */}
      {Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180;
        const major = i % 6 === 0;
        const r0 = major ? 42.2 : 43.6;
        const r1 = 45.4;
        const x0 = 50 + r0 * Math.sin(a);
        const y0 = 50 - r0 * Math.cos(a);
        const x1 = 50 + r1 * Math.sin(a);
        const y1 = 50 - r1 * Math.cos(a);
        return (
          <line
            key={i}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke={major ? "rgba(232,224,255,0.55)" : "rgba(160,148,220,0.28)"}
            strokeWidth={major ? 0.55 : 0.3}
          />
        );
      })}

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

      {/* Cardinal letters + door labels */}
      {CARDINALS.map(({ dir, letter, label, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const lx = 50 + 38.6 * Math.sin(rad);
        const ly = 50 - 38.6 * Math.cos(rad);
        const tx = 50 + 34.2 * Math.sin(rad);
        const ty = 50 - 34.2 * Math.cos(rad);
        const on = lit === dir;
        return (
          <g key={dir} className={`onyx-compass-cardinal${on ? " on" : ""}`}>
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="onyx-compass-letter"
              fill={on ? "#f4f0ff" : "rgba(210,200,240,0.72)"}
              filter={on ? "url(#ocr-glow)" : undefined}
            >
              {letter}
            </text>
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              className="onyx-compass-door"
              fill={on ? "rgba(200,188,255,0.95)" : "rgba(140,130,180,0.45)"}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Aim wedge on locked cardinal */}
      {lit && (
        <path
          className="onyx-compass-wedge"
          d={wedgePath(lit)}
          fill="rgba(169,156,255,0.18)"
          stroke="rgba(200,188,255,0.55)"
          strokeWidth="0.4"
          filter="url(#ocr-glow)"
        />
      )}

      {/* Needle — tracks pointer while holding */}
      <g
        className={`onyx-compass-needle${needleOn ? " on" : ""}`}
        transform={`rotate(${needleDeg.toFixed(1)} 50 50)`}
      >
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="18.5"
          stroke="rgba(232,224,255,0.15)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="18.5"
          stroke={needleOn ? "#f2eeff" : "rgba(180,168,230,0.35)"}
          strokeWidth="0.7"
          strokeLinecap="round"
          filter={needleOn ? "url(#ocr-glow)" : undefined}
        />
        <circle
          cx="50"
          cy="18.2"
          r={needleOn ? 1.35 : 0.9}
          fill={needleOn ? "#fff" : "rgba(200,188,255,0.5)"}
        />
        <circle cx="50" cy="50" r="1.8" fill="#1a1228" stroke="rgba(220,210,255,0.55)" strokeWidth="0.45" />
        <circle cx="50" cy="50" r="0.7" fill="#e8e0ff" />
      </g>
    </svg>
  );
}

function wedgePath(dir: CompassRoseDir): string {
  // Soft pie slice toward the aimed cardinal, between inner and outer rings.
  const center = { up: -90, right: 0, down: 90, left: 180 }[dir];
  const a0 = ((center - 18) * Math.PI) / 180;
  const a1 = ((center + 18) * Math.PI) / 180;
  const r0 = 31.4;
  const r1 = 45.2;
  const p = (r: number, a: number) => `${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}
