"use client";

import { OBS, spectrumAccent } from "../lib/design/observatoryTokens";

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

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

function cardinal(deg: number): string {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? "N";
}

export type SkyCompassProps = {
  headingDeg: number;
  live?: boolean;
  emfUt?: number | null;
  warmth?: number;
  className?: string;
};

/** Steampunk brass compass dock — rose spins with device heading, needle fixed north-up. */
export function SkyCompass({
  headingDeg,
  live = false,
  emfUt = null,
  warmth = 0.55,
  className = "",
}: SkyCompassProps) {
  const h = ((headingDeg % 360) + 360) % 360;
  const accent = spectrumAccent(warmth);
  const cx = 60;
  const cy = 60;
  const r = 44;
  const dialSpin = -h;

  return (
    <div
      className={`cp-sky-compass-dock${className ? ` ${className}` : ""}`}
      aria-label={`Compass heading ${Math.round(h)} degrees ${cardinal(h)}`}
    >
      <div className="cp-sky-compass-bracket cp-sky-compass-bracket-l" aria-hidden />
      <div className="cp-sky-compass-bracket cp-sky-compass-bracket-r" aria-hidden />

      <svg
        className="cp-sky-compass-svg"
        viewBox="0 0 120 120"
        width={120}
        height={120}
        role="img"
        aria-hidden
      >
        <defs>
          <radialGradient id="scp-face" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="rgba(28, 32, 42, 0.95)" />
            <stop offset="72%" stopColor="rgba(10, 12, 18, 0.98)" />
            <stop offset="100%" stopColor="rgba(5, 7, 11, 1)" />
          </radialGradient>
          <linearGradient id="scp-brass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8c86a" />
            <stop offset="45%" stopColor="#c9a227" />
            <stop offset="100%" stopColor="#8a6b1e" />
          </linearGradient>
          <filter id="scp-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer case — steampunk brass ring */}
        <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="url(#scp-brass)" strokeWidth={2.5} opacity={0.9} />
        <circle cx={cx} cy={cy} r={r + 7.5} fill="none" stroke="rgba(201, 162, 39, 0.22)" strokeWidth={0.75} />
        <circle cx={cx} cy={cy} r={r + 4} fill="rgba(5, 7, 11, 0.92)" stroke={OBS.vector.structural} strokeWidth={0.6} />

        {/* Rivets */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * 45 - 90) * (Math.PI / 180);
          const rx = cx + Math.cos(a) * (r + 9.5);
          const ry = cy + Math.sin(a) * (r + 9.5);
          return (
            <circle key={i} cx={rx} cy={ry} r={1.6} fill="#6a5420" stroke="#c9a227" strokeWidth={0.4} />
          );
        })}

        {/* Decorative gear teeth (static) */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15 - 90) * (Math.PI / 180);
          const x1 = cx + Math.cos(a) * (r + 3);
          const y1 = cy + Math.sin(a) * (r + 3);
          const x2 = cx + Math.cos(a) * (r + 5.5);
          const y2 = cy + Math.sin(a) * (r + 5.5);
          return (
            <line
              key={`g${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(201, 162, 39, 0.35)"
              strokeWidth={i % 3 === 0 ? 1.2 : 0.6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Rotating rose */}
        <g transform={`rotate(${dialSpin} ${cx} ${cy})`} style={{ transition: live ? "none" : "transform 0.15s ease-out" }}>
          <circle cx={cx} cy={cy} r={r} fill="url(#scp-face)" stroke="rgba(201, 162, 39, 0.28)" strokeWidth={0.8} />

          {COMPASS_DIRS.map(({ deg, label, major }) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const inner = r - (major ? 6 : 8);
            const outer = r - 2;
            const isN = label === "N";
            return (
              <g key={label}>
                <line
                  x1={cx + Math.cos(rad) * inner}
                  y1={cy + Math.sin(rad) * inner}
                  x2={cx + Math.cos(rad) * outer}
                  y2={cy + Math.sin(rad) * outer}
                  stroke={isN ? accent : major ? "rgba(201, 162, 39, 0.75)" : "rgba(148, 163, 184, 0.45)"}
                  strokeWidth={major ? 1.4 : 0.75}
                  strokeLinecap="round"
                />
                {(major || isN) && (
                  <text
                    x={cx + Math.cos(rad) * (r - 11)}
                    y={cy + Math.sin(rad) * (r - 11) + 3}
                    textAnchor="middle"
                    fontSize={isN ? 9 : major ? 7 : 5}
                    fill={isN ? accent : "rgba(226, 232, 240, 0.82)"}
                    fontWeight={isN ? 700 : major ? 600 : 400}
                    fontFamily={OBS.typography.micro}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Inner degree ring */}
          <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke="rgba(201, 162, 39, 0.12)" strokeWidth={0.5} strokeDasharray="2 4" />
        </g>

        {/* Fixed north needle */}
        <g filter="url(#scp-glow)">
          <polygon
            points={`${cx},${cy - r + 8} ${cx + 3.5},${cy + 4} ${cx - 3.5},${cy + 4}`}
            fill={accent}
            opacity={0.96}
          />
          <polygon
            points={`${cx},${cy + r - 8} ${cx + 2.5},${cy - 2} ${cx - 2.5},${cy - 2}`}
            fill="rgba(148, 163, 184, 0.65)"
            opacity={0.85}
          />
        </g>

        <circle cx={cx} cy={cy} r={4} fill="rgba(5, 7, 11, 0.95)" stroke="url(#scp-brass)" strokeWidth={1.2} />
        <circle cx={cx} cy={cy} r={1.8} fill={accent} />
      </svg>

      <div className="cp-sky-compass-readout">
        <span className="cp-sky-compass-deg">{Math.round(h)}°</span>
        <span className="cp-sky-compass-dir">{cardinal(h)}</span>
        <span className={`cp-sky-compass-live${live ? " cp-sky-compass-live-on" : ""}`}>
          {live ? "● LIVE" : "○ MANUAL"}
        </span>
        {emfUt != null && (
          <span className="cp-sky-compass-emf">{emfUt.toFixed(1)} µT</span>
        )}
      </div>
    </div>
  );
}
