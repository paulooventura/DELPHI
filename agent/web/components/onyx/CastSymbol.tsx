"use client";

import type { CastSymbolSpec, Stroke } from "../../lib/cast/realms";
import { GOLD, INK } from "../../lib/cast/realms";

export function CoinFace({ yang, size = 56 }: { yang: boolean; size?: number }) {
  const gold = GOLD;
  return (
    <svg className="onyx-coin-art" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={yang ? "coinYang" : "coinYin"} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={yang ? "#f0ddb0" : "#c8b8a0"} />
          <stop offset="55%" stopColor={yang ? "#8a6a2e" : "#5a5040"} />
          <stop offset="100%" stopColor="#1a1208" />
        </radialGradient>
      </defs>
      <circle cx={50} cy={50} r={46} fill={`url(#${yang ? "coinYang" : "coinYin"})`} stroke={gold} strokeWidth={1.6} />
      <circle cx={50} cy={50} r={14} fill="#0c0818" stroke={gold} strokeWidth={1.2} />
      {yang ? (
        <rect x={22} y={46} width={56} height={8} rx={3} fill={gold} />
      ) : (
        <g fill={gold}>
          <rect x={18} y={46} width={22} height={8} rx={3} />
          <rect x={60} y={46} width={22} height={8} rx={3} />
        </g>
      )}
    </svg>
  );
}

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
      {spec.kind === "rune" ? (
        <g>
          {tablet(gold)}
          <g transform="translate(10,8) scale(0.8)">
            <Rune strokes={spec.strokes} gold={gold} />
          </g>
        </g>
      ) : null}
      {spec.kind === "odu" ? <Odu nUp={spec.nUp} gold={gold} ink={ink} /> : null}
      {spec.kind === "cowrie-emblem" ? <CowrieEmblem gold={gold} ink={ink} mouthUp /> : null}
      {spec.kind === "orisha-emblem" ? <OrishaEmblem id={spec.id} gold={gold} ink={ink} /> : null}
      {spec.kind === "tarot-major" ? <TarotMajorArt id={spec.id} numeral={spec.numeral} gold={gold} /> : null}
      {spec.kind === "tarot-suit" ? <SuitGlyph suit={spec.suit} rank={spec.rank} gold={gold} /> : null}
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

/** Illustrated cowrie — open (mouth-up) or closed (mouth-down). */
function CowrieEmblem({
  gold,
  ink,
  mouthUp = true,
}: {
  gold: string;
  ink: string;
  mouthUp?: boolean;
}) {
  return (
    <g>
      <ellipse cx={50} cy={52} rx={22} ry={30} fill="rgba(40,28,80,0.7)" stroke={gold} strokeWidth={1.2} />
      <ellipse cx={48} cy={46} rx={10} ry={16} fill="rgba(200,180,255,0.08)" />
      <Cowrie cx={50} cy={52} r={14} gold={gold} ink={ink} mouthUp={mouthUp} />
    </g>
  );
}

function tablet(gold: string) {
  return (
    <g aria-hidden>
      <rect x={8} y={6} width={84} height={88} rx={8} fill="rgba(18,10,36,0.92)" stroke={gold} strokeWidth={1.1} />
      <rect x={12} y={10} width={76} height={80} rx={5} fill="none" stroke="rgba(138,123,255,0.28)" strokeWidth={0.6} />
    </g>
  );
}

function TarotMajorArt({
  id,
  numeral,
  gold,
}: {
  id: string;
  numeral: string;
  gold: string;
}) {
  const stroke = { fill: "none" as const, stroke: gold, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const figure = (() => {
    switch (id) {
      case "ta-maj-0":
        return <path {...stroke} d="M28 72 L50 38 L72 72 M50 38 L50 22 M42 28 L58 22 M22 78 Q50 70 78 78" />;
      case "ta-maj-I":
        return <g {...stroke}><path d="M32 78 V28 H68 V78" /><path d="M28 24 H72" /><circle cx={50} cy={18} r={5} /><path d="M38 48 h24 M50 38 v20" /></g>;
      case "ta-maj-II":
        return <g {...stroke}><path d="M22 80 V22 M78 80 V22" /><path d="M34 36 h32 v28 h-32 z" /><circle cx={50} cy={28} r={6} /></g>;
      case "ta-maj-III":
        return <g {...stroke}><circle cx={50} cy={30} r={10} /><path d="M28 78 Q50 48 72 78" /><path d="M36 62 h28" /></g>;
      case "ta-maj-IV":
        return <g {...stroke}><path d="M24 78 V40 L50 22 L76 40 V78" /><path d="M36 78 V52 h28 v26" /></g>;
      case "ta-maj-V":
        return <g {...stroke}><path d="M22 80 L50 18 L78 80" /><path d="M32 58 h36" /><path d="M38 70 h24" /></g>;
      case "ta-maj-VI":
        return <g {...stroke}><circle cx={38} cy={40} r={9} /><circle cx={62} cy={40} r={9} /><path d="M38 50 Q50 68 62 50" /></g>;
      case "ta-maj-VII":
        return <g {...stroke}><path d="M28 70 h44 v-16 h-44 z" /><path d="M36 54 V36 h28 v18" /><circle cx={36} cy={76} r={6} /><circle cx={64} cy={76} r={6} /></g>;
      case "ta-maj-VIII":
        return <g {...stroke}><circle cx={50} cy={34} r={10} /><path d="M32 78 Q50 48 50 62 Q50 48 68 78" /></g>;
      case "ta-maj-IX":
        return <g {...stroke}><path d="M50 22 v40" /><circle cx={50} cy={70} r={8} /><path d="M38 30 L50 22 L62 30" /></g>;
      case "ta-maj-X":
        return <g {...stroke}><circle cx={50} cy={50} r={22} /><path d="M50 28 V72 M28 50 H72" /><circle cx={50} cy={50} r={6} /></g>;
      case "ta-maj-XI":
        return <g {...stroke}><path d="M50 22 V78" /><path d="M28 40 H72" /><path d="M32 40 L32 28 M68 40 L68 52" /></g>;
      case "ta-maj-XII":
        return <g {...stroke}><path d="M28 22 H72" /><path d="M50 22 V70" /><circle cx={50} cy={78} r={6} /></g>;
      case "ta-maj-XIII":
        return <g {...stroke}><path d="M28 72 L50 28 L72 72" /><path d="M36 56 h28" /><circle cx={50} cy={22} r={5} /></g>;
      case "ta-maj-XIV":
        return <g {...stroke}><path d="M32 30 Q50 18 68 30" /><path d="M36 78 Q50 48 50 38 Q50 48 64 78" /><circle cx={50} cy={34} r={5} /></g>;
      case "ta-maj-XV":
        return <g {...stroke}><path d="M32 78 V38 L50 22 L68 38 V78" /><path d="M40 52 h20" /><circle cx={42} cy={44} r={3} /><circle cx={58} cy={44} r={3} /></g>;
      case "ta-maj-XVI":
        return <g {...stroke}><path d="M36 78 L50 22 L64 78" /><path d="M28 48 L72 56" /><path d="M30 30 L38 38 M70 30 L62 38" /></g>;
      case "ta-maj-XVII":
        return <g {...stroke}><path d="M50 22 L54 36 L68 36 L56 44 L60 58 L50 50 L40 58 L44 44 L32 36 L46 36 Z" /></g>;
      case "ta-maj-XVIII":
        return <g {...stroke}><path d="M62 28 A18 18 0 1 1 38 70 A14 14 0 1 0 62 28" /><circle cx={70} cy={26} r={3} /></g>;
      case "ta-maj-XIX":
        return <g {...stroke}><circle cx={50} cy={48} r={16} /><path d="M50 22 V30 M50 66 V74 M26 48 H34 M66 48 H74 M34 32 L39 37 M66 32 L61 37 M34 64 L39 59 M66 64 L61 59" /></g>;
      case "ta-maj-XX":
        return <g {...stroke}><path d="M28 70 Q50 22 72 70" /><path d="M36 70 h28" /><circle cx={50} cy={28} r={5} /></g>;
      case "ta-maj-XXI":
        return <g {...stroke}><ellipse cx={50} cy={50} rx={24} ry={28} /><circle cx={50} cy={50} r={8} /><path d="M50 22 V30 M50 70 V78 M26 50 H34 M66 50 H74" /></g>;
      default:
        return <circle cx={50} cy={50} r={16} {...stroke} />;
    }
  })();
  return (
    <g>
      {tablet(gold)}
      {figure}
      {numeral ? (
        <text
          x={50}
          y={92}
          textAnchor="middle"
          fill={gold}
          fontSize={7}
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="0.14em"
        >
          {numeral}
        </text>
      ) : null}
    </g>
  );
}

function OrishaEmblem({ id, gold, ink }: { id: string; gold: string; ink: string }) {
  const stroke = { fill: "none" as const, stroke: gold, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      <circle cx={50} cy={50} r={36} fill="rgba(28,16,56,0.88)" stroke={gold} strokeWidth={1.1} />
      {id === "or-eshu" && <path {...stroke} d="M22 50 H78 M50 22 V78 M32 32 L68 68 M68 32 L32 68" />}
      {id === "or-ogun" && <path {...stroke} d="M34 74 L50 22 L54 28 L70 70 M40 56 H64" />}
      {id === "or-yemoja" && <path {...stroke} d="M22 40 Q36 28 50 40 Q64 52 78 40 M22 56 Q36 44 50 56 Q64 68 78 56 M22 72 Q36 60 50 72 Q64 84 78 72" />}
      {id === "or-oshun" && <g {...stroke}><path d="M28 68 Q50 22 72 68" /><circle cx={50} cy={38} r={6} /></g>}
      {id === "or-shango" && <path {...stroke} d="M28 38 H44 L50 22 L56 38 H72 L60 50 L66 72 L50 58 L34 72 L40 50 Z" />}
      {id === "or-oya" && <path {...stroke} d="M28 62 C40 20 70 28 62 52 C80 40 78 72 52 70 C36 80 22 64 28 62" />}
      {id === "or-obatala" && <g {...stroke}><path d="M32 74 L50 22 L68 74" /><path d="M38 56 h24" /></g>}
      {id === "or-orunmila" && <g {...stroke}><circle cx={50} cy={50} r={16} /><path d="M50 26 V18 M50 74 V82 M26 50 H18 M74 50 H82" /><circle cx={50} cy={50} r={4} fill={gold} stroke="none" /></g>}
      {!id.startsWith("or-") && <Cowrie cx={50} cy={50} r={12} gold={gold} ink={ink} mouthUp />}
    </g>
  );
}

function SuitGlyph({
  suit,
  rank,
  gold,
}: {
  suit: "Wands" | "Cups" | "Swords" | "Pentacles";
  rank?: string;
  gold: string;
}) {
  const rankMark = rank ? (
    <text
      x={50}
      y={92}
      textAnchor="middle"
      fill={gold}
      fontSize={8}
      fontFamily="Georgia, 'Times New Roman', serif"
      letterSpacing="0.1em"
    >
      {rank.toUpperCase()}
    </text>
  ) : null;
  if (suit === "Wands") {
    return (
      <g>
        {tablet(gold)}
        <g stroke={gold} fill="none" strokeWidth={2.6} strokeLinecap="round">
          <line x1={50} y1={24} x2={50} y2={72} />
          <ellipse cx={50} cy={30} rx={9} ry={8} />
        </g>
        {rankMark}
      </g>
    );
  }
  if (suit === "Cups") {
    return (
      <g>
        {tablet(gold)}
        <g stroke={gold} fill="none" strokeWidth={2.4} strokeLinecap="round">
          <path d="M34 38 Q50 70 66 38" />
          <line x1={50} y1={60} x2={50} y2={74} />
          <line x1={40} y1={74} x2={60} y2={74} />
        </g>
        {rankMark}
      </g>
    );
  }
  if (suit === "Swords") {
    return (
      <g>
        {tablet(gold)}
        <g stroke={gold} fill="none" strokeWidth={2.4} strokeLinecap="round">
          <line x1={50} y1={22} x2={50} y2={70} />
          <line x1={36} y1={58} x2={64} y2={58} />
          <path d="M44 22 L50 16 L56 22" />
        </g>
        {rankMark}
      </g>
    );
  }
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return [50 + 18 * Math.cos(a), 48 + 18 * Math.sin(a)] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + " Z";
  return (
    <g>
      {tablet(gold)}
      <g stroke={gold} fill="none" strokeWidth={2} strokeLinejoin="round">
        <circle cx={50} cy={48} r={22} />
        <path d={d} />
      </g>
      {rankMark}
    </g>
  );
}
