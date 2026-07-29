/**
 * CASTING — the ritual engine.
 * ----------------------------------------------------------------------------
 * Each of the four realms is cast the way it's cast in life. The OUTCOME is
 * always the crypto-random draw (drawIndex, from cast.ts) — the ritual is the
 * honest PRESENTATION of that draw: the gesture, the pacing, the reveal.
 *
 * Every cast is a three-phase experience, mapped to the Resonant Consent arc:
 *   BEFORE  (Introduction) — arrive, choose depth, hold a question, consent
 *   DURING  (Experience)   — the tradition's real gesture; the draw resolves
 *   AFTER   (Conclusion)   — reveal, integrate, keep-or-release
 *
 * Consent is continuous, expressed through three touchable gemstones:
 *   GREEN  proceed / draw / go deeper / save
 *   YELLOW pause / slow / hold
 *   RED    stop / dismiss / release cleanly
 *
 * The app NARRATES the passage — teaching each tradition's real mechanism while
 * holding the honest frame (a mirror, not a forecast).
 */

import { drawIndex } from "./cast";
import { tarotDeck, castPool, byId, type QualiaEntry } from "./qualia";

export type Phase = "before" | "during" | "after";
export type Stone = "green" | "yellow" | "red";
export type Realm = "tarot" | "iching" | "runes" | "orisha";

/** A drawn object placed in a position, with its orientation. */
export type Placement = {
  entry: QualiaEntry;
  position: string;         // "past" | "line 1" | "the ward" | "Elegba" ...
  reversed?: boolean;       // tarot/rune orientation (another crypto bit)
  changing?: boolean;       // i ching moving line
};

export type CastConfig = {
  realm: Realm;
  depth: string;            // realm-specific depth id (see DEPTHS)
};

export type CastOutcome = {
  realm: Realm;
  depth: string;
  placements: Placement[];
  transformed?: Placement[]; // i ching: the second hexagram from changing lines
  meta: Record<string, unknown>;
};

/* ---- Depths the user can choose (BEFORE phase) ------------------------------ */

export const DEPTHS: Record<Realm, { id: string; label: string; note: string }[]> = {
  tarot: [
    { id: "one", label: "One card", note: "A single focus for the moment." },
    { id: "three", label: "Three cards", note: "Situation, action, outcome." },
    { id: "celtic-cross", label: "Celtic Cross", note: "Ten cards — the full picture." },
  ],
  iching: [
    { id: "hexagram", label: "Cast a hexagram", note: "Six lines, thrown one at a time." },
  ],
  runes: [
    { id: "draw-one", label: "Draw one", note: "A single rune from the bag." },
    { id: "draw-three", label: "Draw three", note: "Norn spread — past, present, future." },
    { id: "draw-five", label: "Draw five", note: "A fuller cross." },
    { id: "scatter", label: "Scatter cast", note: "Tumble on the cloth; the fall is the reading." },
  ],
  orisha: [
    { id: "cowrie", label: "Cast the cowries", note: "Sixteen shells — count what opens." },
  ],
};

/* ---- Positions per depth --------------------------------------------------- */

const TAROT_POSITIONS: Record<string, string[]> = {
  one: ["the focus"],
  three: ["situation", "action", "outcome"],
  "celtic-cross": [
    "the heart", "the crossing", "the foundation", "the recent past",
    "the crown", "the near future", "your stance", "the environment",
    "hopes and fears", "the outcome",
  ],
};

const RUNE_POSITIONS: Record<string, string[]> = {
  "draw-one": ["the rune"],
  "draw-three": ["past", "present", "future"],
  "draw-five": ["the past", "the present", "the challenge", "the path", "the outcome"],
};

/* ---- The cast — crypto choreography per realm ------------------------------ */

/** One unbiased bit. */
function coin(): boolean {
  return drawIndex(2) === 1;
}

/** Draw k distinct entries from a pool by crypto index. */
function drawDistinct(pool: QualiaEntry[], k: number): QualiaEntry[] {
  const p = [...pool];
  const out: QualiaEntry[] = [];
  for (let i = 0; i < Math.min(k, p.length); i++) {
    const idx = drawIndex(p.length);
    out.push(p[idx]);
    p.splice(idx, 1);
  }
  return out;
}

export function performCast(cfg: CastConfig): CastOutcome {
  switch (cfg.realm) {
    case "tarot": {
      const positions = TAROT_POSITIONS[cfg.depth] ?? ["the focus"];
      const cards = drawDistinct(tarotDeck(), positions.length);
      const placements = cards.map((entry, i) => ({
        entry,
        position: positions[i],
        reversed: coin(), // upright/reversed is its own crypto bit
      }));
      return { realm: "tarot", depth: cfg.depth, placements, meta: {} };
    }

    case "iching": {
      // Six lines, bottom to top. Each line: three "coins" → 6/7/8/9.
      // 6 = old yin (changing), 7 = young yang, 8 = young yin, 9 = old yang (changing).
      const lines: { yang: boolean; changing: boolean }[] = [];
      for (let i = 0; i < 6; i++) {
        const sum = (coin() ? 3 : 2) + (coin() ? 3 : 2) + (coin() ? 3 : 2); // 6..9
        lines.push({
          yang: sum === 7 || sum === 9,
          changing: sum === 6 || sum === 9,
        });
      }
      const primaryNum = hexagramNumber(lines.map((l) => l.yang));
      const primary = byId(`ic-hex-${String(primaryNum).padStart(2, "0")}`)!;
      const placements: Placement[] = [{ entry: primary, position: "the hexagram" }];

      // Changing lines → transformed hexagram.
      const hasChanging = lines.some((l) => l.changing);
      let transformed: Placement[] | undefined;
      if (hasChanging) {
        const moved = lines.map((l) => (l.changing ? !l.yang : l.yang));
        const tNum = hexagramNumber(moved);
        const tHex = byId(`ic-hex-${String(tNum).padStart(2, "0")}`)!;
        transformed = [{ entry: tHex, position: "moving toward" }];
      }
      return {
        realm: "iching", depth: cfg.depth, placements, transformed,
        meta: { lines, changingLines: lines.map((l, i) => (l.changing ? i + 1 : null)).filter(Boolean) },
      };
    }

    case "runes": {
      const pool = castPool("rune-cast");
      if (cfg.depth === "scatter") {
        // Scatter: draw 5-9, some face-up (read) some face-down (dormant), reversed matters.
        const count = 5 + drawIndex(5); // 5..9
        const drawn = drawDistinct(pool, count);
        const placements = drawn.map((entry, i) => ({
          entry,
          position: coin() ? "facing the light" : "resting",
          reversed: coin(),
        }));
        return { realm: "runes", depth: cfg.depth, placements, meta: { scatter: true } };
      }
      const positions = RUNE_POSITIONS[cfg.depth] ?? ["the rune"];
      const drawn = drawDistinct(pool, positions.length);
      const placements = drawn.map((entry, i) => ({
        entry, position: positions[i], reversed: coin(),
      }));
      return { realm: "runes", depth: cfg.depth, placements, meta: {} };
    }

    case "orisha": {
      // 16-cowrie homage: cast 16 shells, count mouth-up (0..16) → maps to one of 8.
      let openMouths = 0;
      for (let i = 0; i < 16; i++) if (coin()) openMouths++;
      const pool = castPool("orisha-cast"); // 8 principal Orisha
      // Map the 0..16 count into the 8 pool via even bands; the count IS the cast.
      const idx = Math.min(pool.length - 1, Math.floor(openMouths / (17 / pool.length)));
      const entry = pool[idx];
      return {
        realm: "orisha", depth: cfg.depth,
        placements: [{ entry, position: "the reflection" }],
        meta: { openMouths },
      };
    }
  }
}

/**
 * King Wen hexagram number from six lines (bottom→top, true = yang).
 * Uses the standard trigram→King-Wen lookup.
 * Exported for golden verification (all-yang→1, all-yin→2, Peace→11).
 */
export function hexagramNumber(lines: boolean[]): number {
  const lower = trigramValue(lines.slice(0, 3));
  const upper = trigramValue(lines.slice(3, 6));
  return KING_WEN[upper][lower];
}
function trigramValue(three: boolean[]): number {
  // bottom, middle, top → 0..7 (bottom is least significant)
  return (three[0] ? 1 : 0) + (three[1] ? 2 : 0) + (three[2] ? 4 : 0);
}
// KING_WEN[upper][lower] → hexagram number. Trigram order by value 0..7:
// 0 Kun(☷) 1 Zhen(☳) 2 Kan(☵) 3 Dui(☱) 4 Gen(☶) 5 Li(☲) 6 Xun(☴) 7 Qian(☰)
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

/* ---- Narration — the app explains the passage ------------------------------ */

export const NARRATION: Record<Phase, Record<Realm | "common", string[]>> = {
  before: {
    common: [
      "Before you draw, settle. Divination is a mirror, not a forecast — what you'll see is a reflection to think with.",
      "Hold your question, if you have one. Touch the green stone when you're ready.",
    ],
    tarot: ["Choose your spread. The deck holds seventy-eight cards."],
    iching: ["You'll cast a hexagram — six lines, built from the ground up."],
    runes: [
      "Hold your question. Reach into the bag — one stave (or three for the Norns) leaves the pouch.",
    ],
    orisha: ["Sixteen cowries will be cast — a reflection in the spirit of the tradition, not a babalawo's reading."],
  },
  during: {
    common: ["Touch yellow to slow down. Touch red to let it go."],
    tarot: ["The deck is shuffled. Cards are laid into their positions…"],
    iching: ["Three coins, thrown six times. Each throw builds one line, from the ground up…"],
    runes: ["Your hand is in the bag. The stave that finds your fingers is the reading…"],
    orisha: ["The cowries are cast onto the mat. We count how many open to the sky…"],
  },
  after: {
    common: [
      "Here is what was drawn. Sit with it — what lands? What do you want to carry?",
      "Keep this reading, or let it go. Green to save, red to release.",
    ],
    tarot: [], iching: ["If lines were changing, the second hexagram is where this is moving."],
    runes: [], orisha: [],
  },
};

/** Which stones are active in each phase. */
export const STONES_BY_PHASE: Record<Phase, Stone[]> = {
  before: ["green", "red"],            // proceed, or leave before starting
  during: ["yellow", "red"],           // slow, or stop — no "green" mid-cast; the draw is happening
  after: ["green", "red"],             // save (green), or release (red)
};
