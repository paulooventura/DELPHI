"use client";

import type { CastSymbolSpec, Stroke } from "../../lib/cast/realms";
import { GOLD, INK } from "../../lib/cast/realms";

/** Vector sacred figures — gold on indigo, matching scripts/delphi-deck. */
export function CastSymbol({
  spec,
  size = 200,
  gold = GOLD,
  ink = INK,
}: {
  spec: CastSymbolSpec;
  size?: number;
  gold?: string;
  ink?: string;
}) {
  return (
    <svg
      className="onyx-cast-symbol"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
    >
      {spec.kind === "trigram" || spec.kind === "hexagram" ? (
        <Lines pattern={spec.pattern} gold={gold} />
      ) : null}
      {spec.kind === "rune" ? <Rune strokes={spec.strokes} gold={gold} /> : null}
      {spec.kind === "odu" ? <Odu nUp={spec.nUp} gold={gold} ink={ink} /> : null}
      {spec.kind === "cowrie-emblem" ? <CowrieEmblem gold={gold} ink={ink} /> : null}
      {spec.kind === "tarot-major" ? <TarotNumeral numeral={spec.numeral} gold={gold} /> : null}
      {spec.kind === "tarot-suit" ? <SuitGlyph suit={spec.suit} gold={gold} /> : null}
    </svg>
  );
}

function Lines({ pattern, gold }: { pattern: string; gold: string }) {
  const n = pattern.length;
  const full = 62;
  const brk = full * 0.3;
  const lw = 100 / (n * 1.4);
  const gap = 100 / n;
  return (
    <g>
      {Array.from({ length: n }, (_, row) => {
        // pattern[0] = bottom line
        const bit = pattern[row];
        const y = 100 - (row + 0.5) * gap;
        const ry = Math.max(1.2, lw / 2);
        if (bit === "1") {
          return (
            <rect
              key={row}
              x={(100 - full) / 2}
              y={y - ry}
              width={full}
              height={ry * 2}
              rx={ry}
              fill={gold}
            />
          );
        }
        const half = (full - brk) / 2;
        return (
          <g key={row}>
            <rect x={(100 - full) / 2} y={y - ry} width={half} height={ry * 2} rx={ry} fill={gold} />
            <rect
              x={(100 - full) / 2 + half + brk}
              y={y - ry}
              width={half}
              height={ry * 2}
              rx={ry}
              fill={gold}
            />
          </g>
        );
      })}
    </g>
  );
}

function Rune({ strokes, gold }: { strokes: Stroke[]; gold: string }) {
  const lw = 5.5;
  return (
    <g fill="none" stroke={gold} strokeWidth={lw} strokeLinecap="round" strokeLinejoin="round">
      {strokes.map((stroke, i) => {
        const d = stroke
          .map((p, j) => `${j === 0 ? "M" : "L"} ${p[0] * 100} ${p[1] * 100}`)
          .join(" ");
        return <path key={i} d={d} />;
      })}
    </g>
  );
}

function Cowrie({
  cx,
  cy,
  r,
  gold,
  ink,
  mouthUp,
}: {
  cx: number;
  cy: number;
  r: number;
  gold: string;
  ink: string;
  mouthUp: boolean;
}) {
  if (mouthUp) {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.35} fill={gold} />
        <line
          x1={cx}
          y1={cy - r * 0.9}
          x2={cx}
          y2={cy + r * 0.9}
          stroke={ink}
          strokeWidth={Math.max(1.2, r * 0.28)}
        />
        {[0, 1, 2, 3].map(i => {
          const ty = cy - r * 0.7 + i * ((r * 1.4) / 3);
          return (
            <line
              key={i}
              x1={cx - r * 0.22}
              y1={ty}
              x2={cx + r * 0.22}
              y2={ty}
              stroke={ink}
              strokeWidth={Math.max(0.8, r * 0.12)}
            />
          );
        })}
      </g>
    );
  }
  return (
    <g fill="none" stroke={gold}>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.35} strokeWidth={Math.max(0.8, r * 0.18)} />
      <ellipse cx={cx} cy={cy} rx={r * 0.45} ry={r * 0.6} strokeWidth={Math.max(0.6, r * 0.1)} />
    </g>
  );
}

function Odu({ nUp, gold, ink }: { nUp: number; gold: string; ink: string }) {
  const cols = 4;
  const rows = 4;
  const r = 8.5;
  const spacing = 100 / 4.3;
  const gx = 50 - (spacing * (cols - 1)) / 2;
  const gy = 50 - (spacing * (rows - 1)) / 2;
  const shells = [];
  let idx = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      shells.push(
        <Cowrie
          key={idx}
          cx={gx + col * spacing}
          cy={gy + row * spacing}
          r={r}
          gold={gold}
          ink={ink}
          mouthUp={idx < nUp}
        />,
      );
      idx++;
    }
  }
  return <g>{shells}</g>;
}

/** Single open cowrie — reflective Orisha emblem, not an odu count. */
function CowrieEmblem({ gold, ink }: { gold: string; ink: string }) {
  return (
    <g>
      <circle cx={50} cy={50} r={34} fill="rgba(60,40,110,0.55)" />
      <Cowrie cx={50} cy={50} r={16} gold={gold} ink={ink} mouthUp />
    </g>
  );
}

function TarotNumeral({ numeral, gold }: { numeral: string; gold: string }) {
  if (!numeral) return null;
  return (
    <text
      x={50}
      y={56}
      textAnchor="middle"
      fill={gold}
      fontSize={numeral.length > 3 ? 18 : 28}
      fontFamily="Georgia, 'Times New Roman', serif"
      letterSpacing="0.12em"
    >
      {numeral}
    </text>
  );
}

function SuitGlyph({
  suit,
  gold,
}: {
  suit: "Wands" | "Cups" | "Swords" | "Pentacles";
  gold: string;
}) {
  if (suit === "Wands") {
    return (
      <g stroke={gold} fill="none" strokeWidth={3.2} strokeLinecap="round">
        <line x1={50} y1={22} x2={50} y2={78} />
        <ellipse cx={50} cy={28} rx={10} ry={9} />
      </g>
    );
  }
  if (suit === "Cups") {
    return (
      <g stroke={gold} fill="none" strokeWidth={3} strokeLinecap="round">
        <path d="M32 40 Q50 72 68 40" />
        <line x1={50} y1={62} x2={50} y2={78} />
        <line x1={38} y1={78} x2={62} y2={78} />
      </g>
    );
  }
  if (suit === "Swords") {
    return (
      <g stroke={gold} fill="none" strokeWidth={3} strokeLinecap="round">
        <line x1={50} y1={18} x2={50} y2={72} />
        <line x1={34} y1={58} x2={66} y2={58} />
      </g>
    );
  }
  // Pentacles
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return [50 + 22 * Math.cos(a), 50 + 22 * Math.sin(a)] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + " Z";
  return (
    <g stroke={gold} fill="none" strokeWidth={2.4} strokeLinejoin="round">
      <circle cx={50} cy={50} r={28} />
      <path d={d} />
    </g>
  );
}
