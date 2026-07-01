/**
 * Unified visual asset dictionary for the cosmic clock layers.
 * Premium dark-mode palette — HEX codes align with Tailwind / CSS variables in globals.css.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export type CosmicColor = {
  hex: string;
  /** Optional CSS variable reference for dashboard theming */
  cssVar?: string;
  muted?: string;
  glow?: string;
};

export type LunarPhaseAsset = {
  id: string;
  name: string;
  symbol: string;
  minFraction: number;
  maxFraction: number;
  color: CosmicColor;
};

export type SeasonAsset = {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  color: CosmicColor;
  nextEvent: string;
  /** 0–3 astronomical index (Spring → Winter) */
  index: number;
};

export type ShiAnimalAsset = {
  id: string;
  han: string;
  name: string;
  glyph: string;
  color: string;
};

export type TzolkinSealAsset = {
  index: number;
  name: string;
  color: string;
  /** Reference position in the classic 4×5 day-sign grid (row 0–4, col 0–3) */
  layout: { row: number; col: number };
};

export type ZodiacSignAsset = {
  name: string;
  glyph: string;
  element: "fire" | "earth" | "air" | "water";
  color: CosmicColor;
};

export type RingVisualAsset = {
  ringId: number;
  shortName: string;
  accent: string;
  accentMuted?: string;
};

// ─── CSS variable map (inject via style or globals.css) ───────────────────────

export const COSMIC_CSS_VARS = {
  "--cosmic-imperial-gold": "#C9A227",
  "--cosmic-imperial-gold-lt": "#E8C872",
  "--cosmic-imperial-red": "#991B1B",
  "--cosmic-imperial-crimson": "#B91C1C",
  "--cosmic-season-spring": "#22C55E",
  "--cosmic-season-summer": "#D97706",
  "--cosmic-season-autumn": "#EA580C",
  "--cosmic-season-winter": "#38BDF8",
  "--cosmic-element-fire": "#DC2626",
  "--cosmic-element-earth": "#84CC16",
  "--cosmic-element-air": "#EAB308",
  "--cosmic-element-water": "#2563EB",
  "--cosmic-lunar-silver": "#94A3B8",
  "--cosmic-mayan-violet": "#7C3AED",
} as const;

// ─── Intraday clock ───────────────────────────────────────────────────────────

const INTRADAY = {
  seconds: {
    symbol: "⏱",
    color: { hex: "#FBBF24", cssVar: "--cosmic-imperial-gold-lt", glow: "rgba(251, 191, 36, 0.35)" },
  },
  minutes: {
    symbol: "🕐",
    color: { hex: "#F97316", glow: "rgba(249, 115, 22, 0.32)" },
  },
  hours: {
    symbol: "🕛",
    color: { hex: "#D946EF", glow: "rgba(217, 70, 239, 0.28)" },
  },
} as const;

// ─── Chinese Kè / Shí ─────────────────────────────────────────────────────────

const CHINESE_IMPERIAL = {
  palette: {
    gold: { hex: "#C9A227", cssVar: "--cosmic-imperial-gold", muted: "#8B6914", glow: "rgba(201, 162, 39, 0.4)" },
    goldLight: { hex: "#E8C872", cssVar: "--cosmic-imperial-gold-lt" },
    deepRed: { hex: "#991B1B", cssVar: "--cosmic-imperial-red" },
    crimson: { hex: "#B91C1C", cssVar: "--cosmic-imperial-crimson", glow: "rgba(185, 28, 28, 0.35)" },
    ink: { hex: "#1C1917" },
  },
  ke: {
    glyph: "刻",
    symbol: "刻",
    color: { hex: "#FCD34D", cssVar: "--cosmic-imperial-gold-lt" },
    ringAccent: "#FCD34D",
  },
  shi: {
    ringAccent: "#FB923C",
    animals: [
      { id: "zi", han: "子", name: "Rat", glyph: "子", color: "#C9A227" },
      { id: "chou", han: "丑", name: "Ox", glyph: "丑", color: "#A8A29E" },
      { id: "yin", han: "寅", name: "Tiger", glyph: "寅", color: "#EA580C" },
      { id: "mao", han: "卯", name: "Rabbit", glyph: "卯", color: "#86EFAC" },
      { id: "chen", han: "辰", name: "Dragon", glyph: "辰", color: "#B91C1C" },
      { id: "si", han: "巳", name: "Snake", glyph: "巳", color: "#65A30D" },
      { id: "wu", han: "午", name: "Horse", glyph: "午", color: "#DC2626" },
      { id: "wei", han: "未", name: "Goat", glyph: "未", color: "#FDE68A" },
      { id: "shen", han: "申", name: "Monkey", glyph: "申", color: "#D4D4D8" },
      { id: "you", han: "酉", name: "Rooster", glyph: "酉", color: "#F59E0B" },
      { id: "xu", han: "戌", name: "Dog", glyph: "戌", color: "#B45309" },
      { id: "hai", han: "亥", name: "Pig", glyph: "亥", color: "#FDA4AF" },
    ] satisfies ShiAnimalAsset[],
  },
} as const;

// ─── Lunar phases ─────────────────────────────────────────────────────────────

const LUNAR_PHASES: LunarPhaseAsset[] = [
  { id: "new", name: "New Moon", symbol: "🌑", minFraction: 0, maxFraction: 0.0625, color: { hex: "#64748B", muted: "#334155" } },
  { id: "waxing-crescent", name: "Waxing Crescent", symbol: "🌒", minFraction: 0.0625, maxFraction: 0.1875, color: { hex: "#94A3B8", cssVar: "--cosmic-lunar-silver" } },
  { id: "first-quarter", name: "First Quarter", symbol: "🌓", minFraction: 0.1875, maxFraction: 0.3125, color: { hex: "#CBD5E1" } },
  { id: "waxing-gibbous", name: "Waxing Gibbous", symbol: "🌔", minFraction: 0.3125, maxFraction: 0.4375, color: { hex: "#E2E8F0" } },
  { id: "full", name: "Full Moon", symbol: "🌕", minFraction: 0.4375, maxFraction: 0.5625, color: { hex: "#FEF3C7", glow: "rgba(254, 243, 199, 0.45)" } },
  { id: "waning-gibbous", name: "Waning Gibbous", symbol: "🌖", minFraction: 0.5625, maxFraction: 0.6875, color: { hex: "#E2E8F0" } },
  { id: "last-quarter", name: "Last Quarter", symbol: "🌗", minFraction: 0.6875, maxFraction: 0.8125, color: { hex: "#CBD5E1" } },
  { id: "waning-crescent", name: "Waning Crescent", symbol: "🌘", minFraction: 0.8125, maxFraction: 1.0, color: { hex: "#94A3B8" } },
];

/** Map synodic phase fraction 0.0 → 1.0 to a lunar phase asset. */
export function lunarPhaseFromFraction(fraction: number): LunarPhaseAsset {
  const f = ((fraction % 1) + 1) % 1;
  const phase = LUNAR_PHASES.find(p => f >= p.minFraction && f < p.maxFraction);
  return phase ?? LUNAR_PHASES[LUNAR_PHASES.length - 1]!;
}

/** All lunar phase symbols in order (for dial labels). */
export function lunarPhaseSymbols(): string[] {
  return LUNAR_PHASES.map(p => p.symbol);
}

// ─── Solar year / astronomical seasons ────────────────────────────────────────

const SEASONS: SeasonAsset[] = [
  {
    id: "spring",
    name: "Spring",
    symbol: "🌸",
    icon: "🌱",
    index: 0,
    nextEvent: "Summer Solstice",
    color: { hex: "#22C55E", cssVar: "--cosmic-season-spring", muted: "#166534", glow: "rgba(34, 197, 94, 0.35)" },
  },
  {
    id: "summer",
    name: "Summer",
    symbol: "☀️",
    icon: "🌻",
    index: 1,
    nextEvent: "Autumn Equinox",
    color: { hex: "#D97706", cssVar: "--cosmic-season-summer", muted: "#92400E", glow: "rgba(217, 119, 6, 0.38)" },
  },
  {
    id: "autumn",
    name: "Autumn",
    symbol: "🍁",
    icon: "🍂",
    index: 2,
    nextEvent: "Winter Solstice",
    color: { hex: "#EA580C", cssVar: "--cosmic-season-autumn", muted: "#9A3412", glow: "rgba(234, 88, 12, 0.35)" },
  },
  {
    id: "winter",
    name: "Winter",
    symbol: "❄️",
    icon: "🌨️",
    index: 3,
    nextEvent: "Vernal Equinox",
    color: { hex: "#38BDF8", cssVar: "--cosmic-season-winter", muted: "#0C4A6E", glow: "rgba(56, 189, 248, 0.32)" },
  },
];

/** Season from solar ecliptic longitude (0–360°, tropical). */
export function seasonFromSolarLongitude(lambdaDeg: number): SeasonAsset {
  const index = Math.floor(((lambdaDeg % 360) + 360) % 360 / 90) % 4;
  return SEASONS[index]!;
}

export function seasonQuadrantColors(): string[] {
  return SEASONS.map(s => s.color.hex);
}

export function seasonQuadrantSymbols(): string[] {
  return SEASONS.map(s => s.symbol);
}

// ─── Mayan Tzolk'in ───────────────────────────────────────────────────────────

const TZOLKIN_SEALS: TzolkinSealAsset[] = [
  { index: 0, name: "Imix", color: "#EF4444", layout: { row: 0, col: 0 } },
  { index: 1, name: "Ik", color: "#F97316", layout: { row: 0, col: 1 } },
  { index: 2, name: "Akbal", color: "#1E3A5F", layout: { row: 0, col: 2 } },
  { index: 3, name: "Kan", color: "#EAB308", layout: { row: 0, col: 3 } },
  { index: 4, name: "Chikchan", color: "#DC2626", layout: { row: 1, col: 0 } },
  { index: 5, name: "Kimi", color: "#6B7280", layout: { row: 1, col: 1 } },
  { index: 6, name: "Manik", color: "#22C55E", layout: { row: 1, col: 2 } },
  { index: 7, name: "Lamat", color: "#FACC15", layout: { row: 1, col: 3 } },
  { index: 8, name: "Muluk", color: "#0EA5E9", layout: { row: 2, col: 0 } },
  { index: 9, name: "Ok", color: "#F59E0B", layout: { row: 2, col: 1 } },
  { index: 10, name: "Chuen", color: "#A855F7", layout: { row: 2, col: 2 } },
  { index: 11, name: "Eb", color: "#84CC16", layout: { row: 2, col: 3 } },
  { index: 12, name: "Ben", color: "#10B981", layout: { row: 3, col: 0 } },
  { index: 13, name: "Ix", color: "#D946EF", layout: { row: 3, col: 1 } },
  { index: 14, name: "Men", color: "#3B82F6", layout: { row: 3, col: 2 } },
  { index: 15, name: "Kib", color: "#78716C", layout: { row: 3, col: 3 } },
  { index: 16, name: "Kaban", color: "#854D0E", layout: { row: 4, col: 0 } },
  { index: 17, name: "Etznab", color: "#94A3B8", layout: { row: 4, col: 1 } },
  { index: 18, name: "Kawak", color: "#2563EB", layout: { row: 4, col: 2 } },
  { index: 19, name: "Ajaw", color: "#C9A227", layout: { row: 4, col: 3 } },
];

/**
 * Classic Maya dot-and-bar numeral for Tzolk'in tones 1–13.
 * Returns an SVG string (24×32 viewBox) suitable for inline embedding.
 */
export function renderMayanNumeral(tone: number): string {
  const t = Math.max(1, Math.min(13, Math.round(tone)));
  const bars = Math.floor(t / 5);
  const dots = t % 5;

  const dotEls: string[] = [];
  const barEls: string[] = [];
  const cx = 12;
  let y = 26;

  for (let b = 0; b < bars; b++) {
    barEls.push(
      `<line x1="4" y1="${y}" x2="20" y2="${y}" stroke="#E8C872" stroke-width="2.5" stroke-linecap="round"/>`,
    );
    y -= 6;
  }

  if (dots > 0) {
    const startY = bars > 0 ? y - 2 : 22;
    const spacing = dots === 1 ? 0 : 5;
    const startX = cx - ((dots - 1) * spacing) / 2;
    for (let d = 0; d < dots; d++) {
      dotEls.push(
        `<circle cx="${startX + d * spacing}" cy="${startY}" r="2.2" fill="#E8C872"/>`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" role="img" aria-label="Mayan numeral ${t}">`,
    `<rect width="24" height="32" fill="transparent"/>`,
    ...barEls,
    ...dotEls,
    `</svg>`,
  ].join("");
}

// ─── Western zodiac ───────────────────────────────────────────────────────────

const ELEMENT_COLORS = {
  fire: { hex: "#DC2626", cssVar: "--cosmic-element-fire", glow: "rgba(220, 38, 38, 0.35)" },
  earth: { hex: "#84CC16", cssVar: "--cosmic-element-earth", muted: "#65A30D", glow: "rgba(132, 204, 22, 0.3)" },
  air: { hex: "#EAB308", cssVar: "--cosmic-element-air", glow: "rgba(234, 179, 8, 0.32)" },
  water: { hex: "#2563EB", cssVar: "--cosmic-element-water", glow: "rgba(37, 99, 235, 0.35)" },
} as const;

const ZODIAC_SIGNS: ZodiacSignAsset[] = [
  { name: "Aries", glyph: "♈", element: "fire", color: ELEMENT_COLORS.fire },
  { name: "Taurus", glyph: "♉", element: "earth", color: ELEMENT_COLORS.earth },
  { name: "Gemini", glyph: "♊", element: "air", color: ELEMENT_COLORS.air },
  { name: "Cancer", glyph: "♋", element: "water", color: ELEMENT_COLORS.water },
  { name: "Leo", glyph: "♌", element: "fire", color: ELEMENT_COLORS.fire },
  { name: "Virgo", glyph: "♍", element: "earth", color: ELEMENT_COLORS.earth },
  { name: "Libra", glyph: "♎", element: "air", color: ELEMENT_COLORS.air },
  { name: "Scorpio", glyph: "♏", element: "water", color: ELEMENT_COLORS.water },
  { name: "Sagittarius", glyph: "♐", element: "fire", color: ELEMENT_COLORS.fire },
  { name: "Capricorn", glyph: "♑", element: "earth", color: ELEMENT_COLORS.earth },
  { name: "Aquarius", glyph: "♒", element: "air", color: ELEMENT_COLORS.air },
  { name: "Pisces", glyph: "♓", element: "water", color: ELEMENT_COLORS.water },
];

export function zodiacSignByIndex(index: number): ZodiacSignAsset {
  return ZODIAC_SIGNS[((index % 12) + 12) % 12]!;
}

export function zodiacGlyphs(): string[] {
  return ZODIAC_SIGNS.map(z => z.glyph);
}

// ─── Macro cycles ─────────────────────────────────────────────────────────────

const SEXAGENARY = {
  symbol: "🧧",
  ringAccent: "#DC2626",
  color: { hex: "#DC2626", cssVar: "--cosmic-imperial-crimson", glow: "rgba(220, 38, 38, 0.3)" },
} as const;

// ─── Per-ring dashboard accents (ringId 1–10) ─────────────────────────────────

const RING_VISUALS: RingVisualAsset[] = [
  { ringId: 1, shortName: "Sec", accent: INTRADAY.seconds.color.hex },
  { ringId: 2, shortName: "Min", accent: INTRADAY.minutes.color.hex },
  { ringId: 3, shortName: "Hr", accent: INTRADAY.hours.color.hex },
  { ringId: 4, shortName: "Kè", accent: CHINESE_IMPERIAL.ke.ringAccent },
  { ringId: 5, shortName: "Shí", accent: CHINESE_IMPERIAL.shi.ringAccent },
  { ringId: 6, shortName: "Moon", accent: "#94A3B8" },
  { ringId: 7, shortName: "Season", accent: SEASONS[1]!.color.hex },
  { ringId: 8, shortName: "Tzolk'in", accent: "#7C3AED", accentMuted: "#5B21B6" },
  { ringId: 9, shortName: "Zodiac", accent: "#E879F9" },
  { ringId: 10, shortName: "60-yr", accent: SEXAGENARY.ringAccent },
];

export function ringVisual(ringId: number): RingVisualAsset | undefined {
  return RING_VISUALS.find(r => r.ringId === ringId);
}

export function ringAccentColor(ringId: number): string {
  return ringVisual(ringId)?.accent ?? "#C9A227";
}

// ─── Master export ────────────────────────────────────────────────────────────

export const COSMIC_ASSETS = {
  cssVars: COSMIC_CSS_VARS,
  intraday: INTRADAY,
  chinese: CHINESE_IMPERIAL,
  lunar: {
    phases: LUNAR_PHASES,
    phaseFromFraction: lunarPhaseFromFraction,
    symbols: lunarPhaseSymbols,
    ringAccent: "#94A3B8",
  },
  solar: {
    seasons: SEASONS,
    seasonFromLongitude: seasonFromSolarLongitude,
    quadrantColors: seasonQuadrantColors,
    quadrantSymbols: seasonQuadrantSymbols,
    ringAccent: "#22D3EE",
  },
  mayan: {
    seals: TZOLKIN_SEALS,
    sealByIndex: (i: number) => TZOLKIN_SEALS[((i % 20) + 20) % 20]!,
    renderNumeral: renderMayanNumeral,
    ringAccent: "#7C3AED",
    toneColor: "#E8C872",
  },
  zodiac: {
    signs: ZODIAC_SIGNS,
    signByIndex: zodiacSignByIndex,
    glyphs: zodiacGlyphs,
    elements: ELEMENT_COLORS,
    ringAccent: "#E879F9",
  },
  sexagenary: SEXAGENARY,
  rings: RING_VISUALS,
  ringVisual,
  ringAccentColor,
} as const;

export default COSMIC_ASSETS;
