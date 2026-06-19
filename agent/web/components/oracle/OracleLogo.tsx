"use client";

/** Minimalist oracle mark — staff, eye, constellation grid, crescent. */
export function OracleLogo({
  size = 120,
  stage = "full",
  className = "",
}: {
  size?: number;
  /** Animation stage: axis → eye → stars → moon → full */
  stage?: "void" | "axis" | "eye" | "stars" | "moon" | "full";
  className?: string;
}) {
  const lit = (min: typeof stage) => {
    const order = ["void", "axis", "eye", "stars", "moon", "full"] as const;
    return order.indexOf(stage) >= order.indexOf(min);
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`cp-oracle-logo ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="oracle-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5d78e" />
          <stop offset="100%" stopColor="#c9a227" />
        </linearGradient>
        <filter id="oracle-glow">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Constellation grid */}
      <g
        className={`cp-oracle-stars${lit("stars") ? " cp-oracle-lit" : ""}`}
        stroke="url(#oracle-gold)"
        strokeWidth="0.35"
        fill="none"
        opacity={lit("stars") ? 1 : 0}
      >
        <path d="M22 28 L38 22 L50 18 L62 22 L78 28" />
        <path d="M28 38 L50 32 L72 38" />
        <path d="M32 48 L50 42 L68 48" />
        <path d="M38 22 L38 38 L32 48" />
        <path d="M62 22 L62 38 L68 48" />
        <path d="M50 18 L50 32 L50 42" />
        {[
          [22, 28], [38, 22], [50, 18], [62, 22], [78, 28],
          [28, 38], [50, 32], [72, 38], [32, 48], [50, 42], [68, 48],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="1.1"
            fill="#7dd3fc"
            className="cp-oracle-vertex"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </g>

      {/* Eye */}
      <g className={`cp-oracle-eye${lit("eye") ? " cp-oracle-lit" : ""}`} filter="url(#oracle-glow)">
        <path
          d="M32 52 Q50 44 68 52 Q50 68 32 52"
          fill="none"
          stroke="url(#oracle-gold)"
          strokeWidth="1.2"
          opacity={lit("eye") ? 1 : 0}
        />
        <circle cx="50" cy="54" r="3.2" fill="none" stroke="url(#oracle-gold)" strokeWidth="0.9" opacity={lit("eye") ? 1 : 0} />
      </g>

      {/* Staff / needle axis */}
      <g className={`cp-oracle-axis${lit("axis") ? " cp-oracle-lit" : ""}`} filter="url(#oracle-glow)">
        <line
          x1="50" y1="22" x2="50" y2="78"
          stroke="url(#oracle-gold)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity={lit("axis") ? 1 : 0}
        />
        <circle cx="50" cy="20" r="2.2" fill="url(#oracle-gold)" opacity={lit("axis") ? 1 : 0} />
      </g>

      {/* Crescent */}
      <path
        d="M62 62 A6 6 0 1 1 62 74 A4.5 4.5 0 1 0 62 62"
        fill="url(#oracle-gold)"
        className={`cp-oracle-moon${lit("moon") ? " cp-oracle-lit" : ""}`}
        opacity={lit("moon") ? 0.95 : 0}
      />
    </svg>
  );
}
