/**
 * Delphi Realms — tradition-accurate symbol data (port of scripts/delphi-deck/realms.py).
 * Sacred structure is drawn as vectors from defining data — never AI-guessed glyphs.
 *
 *   I Ching  -> line patterns (trigram 3-bit / hexagram 6-bit), bottom-to-top, yang=1
 *   Runes    -> Elder Futhark stroke coordinates, aett order Fehu..Othala
 *   Orisha   -> diloggun: N mouth-up cowries of 16 (odu visual); deity casts use emblem
 *   Tarot    -> majors art-led (numeral); minors suit glyph
 */

export type Pt = readonly [number, number];
export type Stroke = readonly Pt[];

export const GOLD = "#e9d6a8";
export const INK = "#0c0818";

/** King Wen hexagrams — bit 0 = bottom line. */
export const ICHING_LINES: readonly string[] = [
  "111111", "000000", "100010", "010001", "111010", "010111", "010000", "000010",
  "111011", "110111", "111000", "000111", "101111", "111101", "001000", "000100",
  "100110", "011001", "110000", "000011", "100101", "101001", "000001", "100000",
  "100111", "111001", "100001", "011110", "010010", "101101", "001110", "011100",
  "001111", "111100", "000101", "101000", "101011", "110101", "001010", "010100",
  "110001", "100011", "111110", "011111", "000110", "011000", "010110", "011010",
  "101110", "011101", "100100", "001001", "001011", "110100", "001101", "101100",
  "110110", "011011", "110010", "010011", "110011", "001100", "101010", "010101",
];

/** Bagua — bottom-to-top, yang=1. Matches Unicode ☰…☷ visual when drawn bottom-up. */
export const TRIGRAM_BY_ID: Record<string, string> = {
  "ic-qian": "111",
  "ic-kun": "000",
  "ic-zhen": "100",
  "ic-kan": "010",
  "ic-gen": "001",
  "ic-xun": "110",
  "ic-li": "101",
  "ic-dui": "011",
};

export const RUNE_IDS = [
  "ru-fehu", "ru-uruz", "ru-thurisaz", "ru-ansuz", "ru-raidho", "ru-kenaz", "ru-gebo", "ru-wunjo",
  "ru-hagalaz", "ru-nauthiz", "ru-isa", "ru-jera", "ru-eihwaz", "ru-perthro", "ru-algiz", "ru-sowilo",
  "ru-tiwaz", "ru-berkano", "ru-ehwaz", "ru-mannaz", "ru-laguz", "ru-ingwaz", "ru-dagaz", "ru-othala",
] as const;

/** Unit-box strokes: (0,0)=top-left … (1,1)=bottom-right. */
export const RUNE_STROKES: readonly Stroke[][] = [
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.15], [0.85, 0.0]], [[0.3, 0.5], [0.85, 0.35]]],
  [[[0.25, 1], [0.25, 0.1], [0.75, 0.35]], [[0.75, 0.35], [0.75, 1]]],
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.28], [0.7, 0.5], [0.3, 0.72]]],
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.15], [0.8, 0.35]], [[0.3, 0.45], [0.8, 0.65]]],
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.05], [0.75, 0.28], [0.3, 0.5]], [[0.42, 0.5], [0.8, 1]]],
  [[[0.75, 0.05], [0.3, 0.5], [0.75, 0.95]]],
  [[[0.2, 0.05], [0.8, 0.95]], [[0.8, 0.05], [0.2, 0.95]]],
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.05], [0.75, 0.2], [0.3, 0.45]]],
  [[[0.25, 0], [0.25, 1]], [[0.75, 0], [0.75, 1]], [[0.25, 0.4], [0.75, 0.6]]],
  [[[0.3, 0], [0.3, 1]], [[0.15, 0.65], [0.85, 0.35]]],
  [[[0.5, 0], [0.5, 1]]],
  [[[0.55, 0.05], [0.8, 0.3], [0.55, 0.5]], [[0.45, 0.5], [0.2, 0.7], [0.45, 0.95]]],
  [[[0.5, 0], [0.5, 1]], [[0.5, 0.1], [0.8, 0.0]], [[0.5, 0.9], [0.2, 1.0]]],
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.05], [0.75, 0.05]], [[0.75, 0.05], [0.75, 0.35]], [[0.75, 0.35], [0.3, 0.4]]],
  [[[0.5, 0.25], [0.5, 1]], [[0.5, 0.25], [0.15, 0.0]], [[0.5, 0.25], [0.85, 0.0]]],
  [[[0.75, 0.05], [0.35, 0.35], [0.7, 0.55], [0.3, 0.9]]],
  [[[0.5, 0.25], [0.5, 1]], [[0.2, 0.5], [0.5, 0.15], [0.8, 0.5]]],
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.05], [0.78, 0.25], [0.3, 0.5]], [[0.3, 0.5], [0.78, 0.72], [0.3, 0.95]]],
  [[[0.22, 1], [0.22, 0.0]], [[0.78, 1], [0.78, 0.0]], [[0.22, 0.1], [0.5, 0.5], [0.78, 0.1]]],
  [[[0.2, 0], [0.2, 1]], [[0.8, 0], [0.8, 1]], [[0.2, 0.1], [0.5, 0.55], [0.8, 0.1]], [[0.2, 0.1], [0.8, 0.55]], [[0.8, 0.1], [0.2, 0.55]]],
  [[[0.35, 0], [0.35, 1]], [[0.35, 0.05], [0.75, 0.3]]],
  [[[0.5, 0.15], [0.8, 0.5], [0.5, 0.85], [0.2, 0.5], [0.5, 0.15]]],
  [[[0.2, 0.1], [0.2, 0.9]], [[0.8, 0.1], [0.8, 0.9]], [[0.2, 0.1], [0.8, 0.9]], [[0.2, 0.9], [0.8, 0.1]]],
  [[[0.5, 0.1], [0.78, 0.35], [0.5, 0.6], [0.22, 0.35], [0.5, 0.1]], [[0.5, 0.6], [0.32, 0.95]], [[0.5, 0.6], [0.68, 0.95]]],
];

export const ORISHA_ODU_NAMES = [
  "Okana", "Eji Oko", "Ogunda", "Irosun", "Oche", "Obara", "Odi", "Eji Ogbe",
  "Osa", "Ofun", "Owani", "Ejila Shebora", "Metanla", "Merinla", "Marunla", "Merindilogun",
] as const;

/** Reflective emblem only — deity casts are not odu counts. */
export const ORISHA_EMBLEM_UP = 1;

export type CastSymbolSpec =
  | { kind: "trigram"; pattern: string }
  | { kind: "hexagram"; pattern: string }
  | { kind: "rune"; strokes: Stroke[] }
  | { kind: "odu"; nUp: number }
  | { kind: "cowrie-emblem" }
  | { kind: "tarot-major"; numeral: string }
  | { kind: "tarot-suit"; suit: "Wands" | "Cups" | "Swords" | "Pentacles" }
  | { kind: "empty" };

export function symbolForCastEntry(system: string, id: string, glyph?: string): CastSymbolSpec {
  if (system === "iching-trigram") {
    const pattern = TRIGRAM_BY_ID[id];
    return pattern ? { kind: "trigram", pattern } : { kind: "empty" };
  }
  if (system === "iching-hexagram") {
    const m = /^ix-(\d+)$/.exec(id);
    const idx = m ? Number(m[1]) - 1 : -1;
    if (idx >= 0 && idx < ICHING_LINES.length) {
      return { kind: "hexagram", pattern: ICHING_LINES[idx]! };
    }
    return { kind: "empty" };
  }
  if (system === "rune-cast") {
    const idx = RUNE_IDS.indexOf(id as (typeof RUNE_IDS)[number]);
    if (idx >= 0) return { kind: "rune", strokes: RUNE_STROKES[idx]! };
    return { kind: "empty" };
  }
  if (system === "orisha-cast") {
    // Deity pool — emblem, not a fake odu count.
    return { kind: "cowrie-emblem" };
  }
  if (system === "orisha-odu") {
    const m = /^od-(\d+)$/.exec(id);
    const n = m ? Number(m[1]) : 0;
    if (n >= 1 && n <= 16) return { kind: "odu", nUp: n };
    return { kind: "empty" };
  }
  if (system === "tarot-major") {
    return { kind: "tarot-major", numeral: glyph ?? "" };
  }
  return { kind: "empty" };
}
