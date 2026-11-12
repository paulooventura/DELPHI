/**
 * Maya bar-and-dot numeral (1–19), drawn from the notation itself: a dot is one, a bar is five, dots sit above
 * the bars (public-domain inscriptions and codices; no copied artwork). Shown on the Tzolk'in and Dreamspell
 * cards (Paulo 11-11 §1).
 */
import { mayaNumeralParts } from "../../lib/mayaNumeral";

export function MayaNumeral({ n, size = 64, label }: { n: number; size?: number; label?: string }) {
  const { bars, dots } = mayaNumeralParts(n);
  const W = 60;
  const barH = 7;
  const gap = 5;
  const dotR = 4.2;
  const rows = bars + (dots ? 1 : 0);
  const H = rows * (barH + gap) + (dots ? dotR * 2 - barH : 0) + 4;
  let y = 2;
  const shapes: React.ReactNode[] = [];
  if (dots) {
    const span = dots * dotR * 2 + (dots - 1) * 4;
    for (let i = 0; i < dots; i++) {
      shapes.push(<circle key={`d${i}`} cx={W / 2 - span / 2 + dotR + i * (dotR * 2 + 4)} cy={y + dotR} r={dotR} />);
    }
    y += dotR * 2 + gap;
  }
  for (let i = 0; i < bars; i++) {
    shapes.push(<rect key={`b${i}`} x={6} y={y} width={W - 12} height={barH} rx={3.5} />);
    y += barH + gap;
  }
  return (
    <svg
      className="onyx-maya-numeral"
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      role="img"
      aria-label={label ?? `${n} in Maya bar-and-dot numerals`}
      fill="currentColor"
    >
      {shapes}
    </svg>
  );
}
