"use client";

const RING_COUNT = 5;

export function SplashRings({
  visible,
  expanded,
  size = 280,
}: {
  visible: boolean;
  expanded: boolean;
  size?: number;
}) {
  if (!visible) return null;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`cp-splash-rings${expanded ? " cp-splash-rings-expanded" : ""}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="splash-ring-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c872" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8b6914" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {Array.from({ length: RING_COUNT }, (_, i) => {
        const r = 28 + i * 14;
        const ticks = 12 + i * 12;
        return (
          <g key={i} className="cp-splash-ring" style={{ animationDelay: `${i * 80}ms` }}>
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="url(#splash-ring-gold)"
              strokeWidth={0.6 + i * 0.15}
              opacity={0.35 + i * 0.08}
            />
            {Array.from({ length: ticks }, (_, t) => {
              const ang = (t / ticks) * Math.PI * 2 - Math.PI / 2;
              const major = t % (ticks / 4) === 0;
              const x1 = 100 + Math.cos(ang) * (r - (major ? 3 : 1.5));
              const y1 = 100 + Math.sin(ang) * (r - (major ? 3 : 1.5));
              const x2 = 100 + Math.cos(ang) * r;
              const y2 = 100 + Math.sin(ang) * r;
              return (
                <line
                  key={t}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#c9a227"
                  strokeWidth={major ? 0.5 : 0.25}
                  opacity={0.5}
                />
              );
            })}
          </g>
        );
      })}
      <text x="100" y="104" textAnchor="middle" fontSize="8" fill="#c9a227" opacity="0.7">☽</text>
    </svg>
  );
}
