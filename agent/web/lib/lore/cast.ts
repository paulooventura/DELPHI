/**
 * CAST — crypto draw + tradition-faithful spreads.
 * ----------------------------------------------------------------------------
 * Full decks live in qualia.ts (tarot 78, iching 64, runes 24, orisha 8).
 * Ritual choreography / narration lives in casting.ts.
 * This module: unbiased drawIndex + spread helpers used by OnyxCast.
 *
 * Never on the home chord. Never automatic.
 */

import { byId, castPool, tarotDeck, type QualiaEntry } from "./qualia";

/** King Wen number from six lines (bottom→top, true = yang). Shared math with casting.ts. */
function hexagramNumber(lines: boolean[]): number {
  const lower = trigramValue(lines.slice(0, 3));
  const upper = trigramValue(lines.slice(3, 6));
  return KING_WEN[upper]![lower]!;
}
function trigramValue(three: boolean[]): number {
  return (three[0] ? 1 : 0) + (three[1] ? 2 : 0) + (three[2] ? 4 : 0);
}
const KING_WEN: number[][] = [
  [2, 24, 7, 19, 15, 36, 46, 11],
  [16, 51, 40, 54, 62, 55, 32, 34],
  [8, 3, 29, 60, 39, 63, 48, 5],
  [45, 17, 47, 58, 31, 49, 28, 43],
  [23, 27, 4, 41, 52, 22, 18, 26],
  [35, 21, 64, 38, 56, 30, 50, 14],
  [20, 42, 59, 61, 53, 37, 57, 9],
  [12, 25, 6, 10, 33, 13, 44, 1],
];

/** Unbiased index in [0, n). Crypto entropy + rejection sampling — provably uniform. */
export function drawIndex(n: number): number {
  if (n <= 0) throw new Error("deck size must be positive");
  if (n === 1) return 0;
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= max);
  return x % n;
}

function drawBit(): number {
  return drawIndex(2);
}

/** Resolve the cast pool for a CAST_SYSTEMS id (tarot spans major+minor). */
function poolFor(system: string): QualiaEntry[] {
  if (system === "tarot" || system === "tarot-major") return [...tarotDeck()];
  return [...castPool(system)];
}

/** Draw `count` distinct entries from a tradition's pool. */
export function cast(system: string, count = 1): QualiaEntry[] {
  const pool = poolFor(system);
  if (pool.length === 0) return [];
  const out: QualiaEntry[] = [];
  const k = Math.min(count, pool.length);
  for (let i = 0; i < k; i++) {
    const idx = drawIndex(pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}

/** Honest framing per tradition — shown at the moment of the draw. */
export const CAST_FRAMING: Record<
  string,
  { label: string; frame: string; note: string }
> = {
  tarot: {
    label: "Tarot",
    frame: "A card, drawn just now, for you.",
    note: "Rider-Waite-Smith, full 78. Upright and reversed. A free draw — the deck belongs to everyone.",
  },
  "tarot-major": {
    label: "Tarot",
    frame: "A card, drawn just now, for you.",
    note: "Rider-Waite-Smith, full 78. Upright and reversed. A free draw — the deck belongs to everyone.",
  },
  "iching-hexagram": {
    label: "I Ching",
    frame: "A hexagram, cast by the three-coin method.",
    note: "Sixty-four hexagrams of the Zhouyi — six lines built from the bottom up. Changing lines yield a relating hexagram.",
  },
  "rune-cast": {
    label: "Runes",
    frame: "Elder Futhark, cast just now.",
    note: "Full 24-rune Elder Futhark (rune poems). No blank rune. A cast is traditional; a rune 'zodiac' by birthdate is not.",
  },
  "orisha-cast": {
    label: "Orisha",
    frame: "Sixteen cowries, cast just now.",
    note: "Inspired by the Yoruba 16-cowrie method — offered for reflection, NOT a traditional Ifá reading, which is cast and interpreted by an initiated babalawo.",
  },
  "orisha-odu": {
    label: "Orisha",
    frame: "Sixteen cowries, cast just now.",
    note: "Inspired by the Yoruba 16-cowrie method — offered for reflection, NOT a traditional Ifá reading, which is cast and interpreted by an initiated babalawo.",
  },
};

export type TarotSpreadId = "one" | "three" | "celtic";

export type TarotSpread = {
  id: TarotSpreadId;
  label: string;
  blurb: string;
  count: number;
  positions: string[];
  frame: string;
};

export const TAROT_SPREADS: TarotSpread[] = [
  {
    id: "one",
    label: "One card",
    blurb: "A single focus — upright or reversed.",
    count: 1,
    positions: ["Focus"],
    frame: "A card, drawn just now, for you.",
  },
  {
    id: "three",
    label: "Three card",
    blurb: "Past · Present · Future",
    count: 3,
    positions: ["Past", "Present", "Future"],
    frame: "Three cards — past, present, and what leans forward.",
  },
  {
    id: "celtic",
    label: "Celtic Cross",
    blurb: "Ten positions. The full map.",
    count: 10,
    positions: [
      "Present",
      "Challenge",
      "Foundation",
      "Recent past",
      "Crown",
      "Near future",
      "Approach",
      "Environment",
      "Hopes & fears",
      "Outcome",
    ],
    frame: "The Celtic Cross — ten cards, drawn just now.",
  },
];

export type OrishaModeId = "diloggun" | "names";

export type OrishaMode = {
  id: OrishaModeId;
  label: string;
  blurb: string;
  frame: string;
};

export const ORISHA_MODES: OrishaMode[] = [
  {
    id: "diloggun",
    label: "Sixteen cowries",
    blurb: "Mérìndílógún homage — count the mouths that open.",
    frame: "Sixteen cowries cast — a reflection from the open mouths.",
  },
  {
    id: "names",
    label: "Orisha names",
    blurb: "Reflective draw among principal Orisha — not a cowrie cast.",
    frame: "A principal Orisha, drawn for reflection.",
  },
];

export type IChingModeId = "coins";

export type IChingMode = {
  id: IChingModeId;
  label: string;
  blurb: string;
  frame: string;
};

export const ICHING_MODES: IChingMode[] = [
  {
    id: "coins",
    label: "Hexagram (coins)",
    blurb: "Three coins × six lines — changing lines when they appear.",
    frame: "A hexagram cast by the three-coin method.",
  },
];

export type RuneSpreadId = "one" | "norns";

export type RuneSpread = {
  id: RuneSpreadId;
  label: string;
  blurb: string;
  count: number;
  positions: string[];
  frame: string;
};

export const RUNE_SPREADS: RuneSpread[] = [
  {
    id: "one",
    label: "One rune",
    blurb: "A single stave from the Futhark.",
    count: 1,
    positions: ["The rune"],
    frame: "A rune, drawn just now.",
  },
  {
    id: "norns",
    label: "Norns (three)",
    blurb: "What was · what is · what leans forward",
    count: 3,
    positions: ["What was", "What is", "What leans forward"],
    frame: "Three runes — the Norns' cast.",
  },
];

export function tarotSpreadById(id: TarotSpreadId): TarotSpread {
  const s = TAROT_SPREADS.find(x => x.id === id);
  if (!s) throw new Error(`unknown tarot spread: ${id}`);
  return s;
}

/** Ritual film played when that tradition is cast (public/ assets). */
export const CAST_RITUAL_VIDEO: Record<string, string> = {
  tarot: "/cast-tarot.mp4",
  "tarot-major": "/cast-tarot.mp4",
  "orisha-cast": "/cast-orisha.mp4",
  "orisha-odu": "/cast-orisha.mp4",
  "iching-hexagram": "/cast-iching.mp4",
  "rune-cast": "/cast-runes.mp4",
};

export type DrawnCard = {
  entry: QualiaEntry;
  reversed?: boolean;
};

export type CastResult = {
  system: string;
  framing: { label: string; frame: string; note: string };
  drawn: QualiaEntry[];
  cards?: DrawnCard[];
  positions?: string[];
  spreadId?: string;
  spreadLabel?: string;
  cowrieUp?: number;
  ichingLines?: number[];
  changingLines?: number[];
  relating?: QualiaEntry;
};

export function castReading(system: string, count = 1): CastResult {
  const key = system === "tarot" ? "tarot" : system;
  return { system: key, framing: CAST_FRAMING[key] ?? CAST_FRAMING.tarot!, drawn: cast(key, count) };
}

export function castTarotSpread(spreadId: TarotSpreadId): CastResult {
  const spread = tarotSpreadById(spreadId);
  const base = CAST_FRAMING.tarot!;
  const drawn = cast("tarot", spread.count);
  const cards: DrawnCard[] = drawn.map(entry => ({
    entry,
    reversed: drawBit() === 1,
  }));
  return {
    system: "tarot",
    framing: { ...base, frame: spread.frame },
    drawn,
    cards,
    positions: spread.positions,
    spreadId: spread.id,
    spreadLabel: spread.label,
  };
}

/**
 * Sixteen shells → mouth-up count → maps into the 8 principal Orisha pool.
 * Honesty boundary: Orisha corpus stays length 8 (not expanded to 256 odu).
 */
export function castOrishaDiloggun(): CastResult {
  let nUp = 0;
  for (let i = 0; i < 16; i++) if (drawBit() === 1) nUp++;
  const pool = castPool("orisha-cast");
  const idx = Math.min(pool.length - 1, Math.floor(nUp / (17 / pool.length)));
  const entry = pool[idx]!;
  const base = CAST_FRAMING["orisha-cast"]!;
  return {
    system: "orisha-cast",
    framing: {
      label: base.label,
      frame: ORISHA_MODES[0]!.frame,
      note: base.note,
    },
    drawn: [entry],
    cards: [{ entry }],
    cowrieUp: nUp,
    spreadId: "diloggun",
    spreadLabel: "Sixteen cowries",
    positions: [`${nUp} mouth${nUp === 1 ? "" : "s"} up`],
  };
}

export function castOrishaNames(): CastResult {
  const drawn = cast("orisha-cast", 1);
  const base = CAST_FRAMING["orisha-cast"]!;
  return {
    system: "orisha-cast",
    framing: {
      label: base.label,
      frame: ORISHA_MODES[1]!.frame,
      note: "Reflective draw among principal Orisha figures — not a cowrie cast, and NOT a traditional Ifá reading.",
    },
    drawn,
    cards: drawn.map(entry => ({ entry })),
    spreadId: "names",
    spreadLabel: "Orisha names",
  };
}

export function castOrishaMode(mode: OrishaModeId): CastResult {
  return mode === "diloggun" ? castOrishaDiloggun() : castOrishaNames();
}

function castCoinLine(): number {
  let sum = 0;
  for (let i = 0; i < 3; i++) sum += drawBit() === 1 ? 3 : 2;
  return sum;
}

function lineToYang(value: number): boolean {
  return value === 7 || value === 9;
}

function lineChanges(value: number): boolean {
  return value === 6 || value === 9;
}

function hexEntry(n: number): QualiaEntry {
  const id = `ic-hex-${String(n).padStart(2, "0")}`;
  const entry = byId(id);
  if (!entry) throw new Error(`missing hexagram ${id}`);
  return entry;
}

export function castIChingCoins(): CastResult {
  const lines: number[] = [];
  for (let i = 0; i < 6; i++) lines.push(castCoinLine());

  const primaryYang = lines.map(lineToYang);
  const relatingYang = lines.map(v => (lineChanges(v) ? !lineToYang(v) : lineToYang(v)));
  const primaryN = hexagramNumber(primaryYang);
  const relatingN = hexagramNumber(relatingYang);
  const primary = hexEntry(primaryN);
  const relating = relatingN !== primaryN ? hexEntry(relatingN) : undefined;

  const changing = lines
    .map((v, i) => (lineChanges(v) ? i + 1 : 0))
    .filter(n => n > 0);

  const base = CAST_FRAMING["iching-hexagram"]!;
  const drawn = relating ? [primary, relating] : [primary];
  const positions = relating
    ? ["Primary hexagram", "Relating hexagram"]
    : ["Hexagram"];

  return {
    system: "iching-hexagram",
    framing: {
      label: base.label,
      frame: ICHING_MODES[0]!.frame,
      note: base.note,
    },
    drawn,
    cards: drawn.map(entry => ({ entry })),
    positions,
    ichingLines: lines,
    changingLines: changing,
    relating,
    spreadId: "coins",
    spreadLabel:
      changing.length > 0
        ? `Coins · changing ${changing.join(", ")}`
        : "Coins · no changing lines",
  };
}

export function castIChingMode(_mode: IChingModeId): CastResult {
  return castIChingCoins();
}

export function castRuneSpread(spreadId: RuneSpreadId): CastResult {
  const spread = RUNE_SPREADS.find(s => s.id === spreadId);
  if (!spread) throw new Error(`unknown rune spread: ${spreadId}`);
  const base = CAST_FRAMING["rune-cast"]!;
  const drawn = cast("rune-cast", spread.count);
  return {
    system: "rune-cast",
    framing: { ...base, frame: spread.frame },
    drawn,
    cards: drawn.map(entry => ({ entry })),
    positions: spread.positions,
    spreadId: spread.id,
    spreadLabel: spread.label,
  };
}
