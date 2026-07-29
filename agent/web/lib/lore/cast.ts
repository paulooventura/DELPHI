/**
 * CAST — the divination layer. Genuine random draws, honestly framed.
 * ----------------------------------------------------------------------------
 * The moment-chord is COMPUTED from the sky. Divination is different: tarot,
 * Ifá, I Ching, and runes are DRAWN — meaning emerges from the cast, not from
 * the clock. This file keeps them honest:
 *
 *   1. The draw uses crypto entropy, not Math.random(). For a feature whose
 *      integrity rests on "this was a true cast, not rigged," that one detail
 *      IS the feature.
 *   2. Rejection sampling removes modulo bias — every card exactly equally
 *      likely. A divination tool that claims fairness must be provably uniform.
 *   3. Each tradition is framed as what it actually is. Orisha especially:
 *      "a reflective draw inspired by the 16-cowrie method," never "your Ifá
 *      reading" — traditional Ifá is cast by an initiated babalawo.
 *
 * Never on the home screen. Never automatic. The user chooses whether to cast
 * and which tradition. Off by default.
 *
 * Full-fidelity decks live in qualia.ts (tarot 78, iching 64, runes 24, orisha 8).
 * Ritual choreography is in casting.ts — this module is the crypto draw only.
 */

import { castPool, tarotDeck, type QualiaEntry } from "./qualia";

/** Unbiased index in [0, n). Crypto entropy + rejection sampling — provably uniform. */
export function drawIndex(n: number): number {
  if (n <= 0) throw new Error("deck size must be positive");
  if (n === 1) return 0;
  const max = Math.floor(0xffffffff / n) * n; // largest unbiased ceiling
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= max); // reject the biased tail
  return x % n;
}

/** Resolve the cast pool for a CAST_SYSTEMS id (tarot spans major+minor). */
function poolFor(system: string): QualiaEntry[] {
  if (system === "tarot") return [...tarotDeck()];
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
    pool.splice(idx, 1); // draw without replacement
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
    note: "Rider-Waite-Smith, full 78. A free draw — the deck belongs to everyone.",
  },
  "iching-hexagram": {
    label: "I Ching",
    frame: "A hexagram, cast just now.",
    note: "Sixty-four hexagrams of the Zhouyi — six lines built from the bottom up.",
  },
  "rune-cast": {
    label: "Runes",
    frame: "A rune, drawn just now.",
    note:
      "Elder Futhark, whose meanings survive in the rune poems. A cast is traditional; a rune 'zodiac' by birthdate is a modern invention.",
  },
  "orisha-cast": {
    label: "Orisha",
    frame: "A reflection, drawn in the spirit of the 16-cowrie tradition.",
    note:
      "Inspired by the Yoruba 16-cowrie method — offered for reflection, NOT a traditional Ifá reading, which is cast and interpreted by an initiated babalawo.",
  },
};

/** Ritual film played when that tradition is cast (public/ assets). */
export const CAST_RITUAL_VIDEO: Record<string, string> = {
  tarot: "/cast-tarot.mp4",
  "orisha-cast": "/cast-orisha.mp4",
  "iching-hexagram": "/cast-iching.mp4",
  "rune-cast": "/cast-runes.mp4",
};

export type CastResult = {
  system: string;
  framing: (typeof CAST_FRAMING)[string];
  drawn: QualiaEntry[];
};

export function castReading(system: string, count = 1): CastResult {
  return { system, framing: CAST_FRAMING[system], drawn: cast(system, count) };
}
