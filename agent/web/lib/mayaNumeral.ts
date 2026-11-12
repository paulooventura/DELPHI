/** Maya bar-and-dot numeral parts for 1–19: bars of five, the rest as dots. */
export function mayaNumeralParts(n: number): { bars: number; dots: number } {
  const v = Math.max(1, Math.min(19, Math.round(n)));
  return { bars: Math.floor(v / 5), dots: v % 5 };
}
