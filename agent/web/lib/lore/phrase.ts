/**
 * PHRASE — the local distillation voice. NO API. NO third-party dependency.
 * ----------------------------------------------------------------------------
 * This turns the orchestration (root · tension · inflection · tone) into one
 * spoken sentence, entirely on-device, for free, forever. It is NOT a fallback
 * anymore — it is THE voice of Delphi.
 *
 * It reads intelligently because it reads STRUCTURE, not a word-list:
 *   - the ROOT axis picks a grounding NOUN (the subject — "a warmth", "a hush")
 *   - supporting axes pick ADJECTIVES that agree with the root's pole
 *   - the TENSION becomes the sentence's TURN (the em-dash hinge), never smoothed
 *   - the REGISTER (from tone) picks the sentence SHAPE and whether it dares you
 *   - the INFLECTION adds a fast-cycle texture clause when present
 *
 * Variety is real, not random: the inputs (which of 478 entries are active, in
 * which combination, at what strengths) change constantly, so the same grammar
 * yields a different true sentence each moment. A seeded shuffle over synonym
 * pools keeps it fresh without ever being arbitrary — the seed is the moment
 * itself, so the same moment always reads the same (honest), different moments
 * read differently (alive).
 */

import type { Composition, Orchestration, Tone } from "./compose";
import { orchestrate } from "./compose";

type Axis = "active" | "rising" | "steady" | "warm" | "outward" | "binding" | "gentle" | "light";

/* ---- Vocabulary, keyed by axis and pole. Authored, not generated. --------- */
/* Each axis pole offers NOUNS (for when it's the root/subject) and ADJECTIVES
   (for when it's a supporting quality). Multiple options → variety.            */

const POS = 1, NEG = -1;

const NOUNS: Record<Axis, Record<number, string[]>> = {
  warm:    { [POS]: ["warmth", "glow", "heat"], [NEG]: ["coolness", "chill", "cold clarity"] },
  light:   { [POS]: ["brightness", "clarity", "light"], [NEG]: ["dimness", "dusk", "shadow"] },
  active:  { [POS]: ["drive", "momentum", "surge"], [NEG]: ["stillness", "quiet", "hush"] },
  rising:  { [POS]: ["ascent", "rising", "swell"], [NEG]: ["settling", "descent", "ebb"] },
  steady:  { [POS]: ["steadiness", "poise", "hold"], [NEG]: ["restlessness", "flux", "unrest"] },
  outward: { [POS]: ["openness", "reaching", "outward pull"], [NEG]: ["inwardness", "turning-in", "withdrawal"] },
  binding: { [POS]: ["structure", "gathering", "binding"], [NEG]: ["dissolution", "loosening", "release"] },
  gentle:  { [POS]: ["tenderness", "softness", "grace"], [NEG]: ["sharpness", "edge", "bite"] },
};

const ADJ: Record<Axis, Record<number, string[]>> = {
  warm:    { [POS]: ["warm", "glowing", "sunlit"], [NEG]: ["cool", "cold", "clear"] },
  light:   { [POS]: ["bright", "lit", "luminous"], [NEG]: ["dim", "darkening", "veiled"] },
  active:  { [POS]: ["driving", "restless", "quickening"], [NEG]: ["still", "quiet", "slow"] },
  rising:  { [POS]: ["rising", "gathering", "cresting"], [NEG]: ["settling", "waning", "sinking"] },
  steady:  { [POS]: ["steady", "holding", "rooted"], [NEG]: ["restless", "shifting", "unsettled"] },
  outward: { [POS]: ["open", "outward", "reaching"], [NEG]: ["inward", "quiet", "withdrawn"] },
  binding: { [POS]: ["gathering", "binding", "consolidating"], [NEG]: ["loosening", "dissolving", "unbinding"] },
  gentle:  { [POS]: ["tender", "gentle", "soft"], [NEG]: ["sharp", "fierce", "cutting"] },
};

/* Tension phrasings — the TURN. Keyed loosely by register so the hinge matches
   the voice. {a} = the assertive pole word, {b} = the counter pole word.       */
const TURNS: Record<Tone["register"], string[]> = {
  "warm-witness": [
    "{a} and yet {b} underneath",
    "{a}, with something {b} resting beneath it",
    "mostly {a}, though a {b} thread runs through",
  ],
  "plain-reading": [
    "{a}, with a {b} current beneath",
    "{a} on the surface, {b} below",
    "{a} — and quietly {b} at the same time",
  ],
  "quiet-riddle": [
    "{a}, though something {b} waits under it",
    "{a} — and what's {b} beneath has not yet spoken",
    "{a}, hiding a {b} turn",
  ],
  "trickster-challenge": [
    "{a} — but already pulling toward {b}",
    "{a}, and just as surely {b}; it won't stay put",
    "{a} while something {b} strains against it",
  ],
};

/* Register frames — how the whole sentence is shaped and whether it turns to
   the user. {S} = the core reading (subject + turn + inflection).              */
const FRAMES: Record<Tone["register"], string[]> = {
  "warm-witness": [
    "{S}.",
    "There's {s} — {rest}.",
    "{S} — a moment worth resting in.",
  ],
  "plain-reading": [
    "{S}.",
    "The moment is {s} — {rest}.",
    "{S}, as things stand.",
  ],
  "quiet-riddle": [
    "{S}.",
    "{S} — make of it what you will.",
    "Something in the hour is {s}; {rest}.",
  ],
  "trickster-challenge": [
    "{S}. So — what will you do with it?",
    "{S}. The moment's on the table; your move.",
    "You've got {s} — {rest}. What now?",
  ],
};

/* ---- Deterministic-but-varied choice: seed from the moment itself. -------- */

function seedFrom(o: Orchestration): number {
  // A stable seed from the structure — same moment → same phrase, different
  // moment → different phrase. Uses root axis/pole + tension + fieldSize.
  const r = o.root ? o.root.axis.length * 7 + Math.round(o.root.pole * 100) : 0;
  const t = o.tension ? o.tension.axis.length * 13 + Math.round(o.tension.strength * 100) : 0;
  return Math.abs((r * 31 + t * 17 + o.fieldSize * 5)) % 997;
}
function pick<T>(arr: T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length];
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const withArticle = (w: string) => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;

/* ---- The engine ----------------------------------------------------------- */

/**
 * Produce the distilled sentence from a composition — locally, no API.
 * This is the primary voice of Delphi.
 */
export function speak(c: Composition): string {
  const o = orchestrate(c);
  const seed = seedFrom(o);
  const reg = o.tone.register;

  // 1. SUBJECT from the root.
  if (!o.root) {
    return pick(
      ["A quiet, in-between moment, poised between currents.",
       "A still point, waiting to tip one way or another.",
       "An even moment — nothing pulling hard in any direction."],
      seed, 0,
    );
  }
  const rootPole = o.root.pole >= 0 ? POS : NEG;
  const rootAxis = o.root.axis as Axis;
  const noun = pick(NOUNS[rootAxis][rootPole], seed, 1);

  // 2. One or two supporting ADJECTIVES from the next-strongest axes (not root).
  const supports = c.axes
    .filter((a) => a.axis !== o.root!.axis && Math.abs(a.mean) > 0.3)
    .sort((a, b) => Math.abs(b.mean) * b.coherence - Math.abs(a.mean) * a.coherence)
    .slice(0, 2)
    .map((a) => {
      const pole = a.mean >= 0 ? POS : NEG;
      return pick(ADJ[a.axis as Axis][pole], seed, a.axis.length);
    });

  // subject: "a bright, gathering warmth"
  let subject: string;
  if (supports.length === 2) subject = `${withArticle(supports[0])}, ${supports[1]} ${noun}`;
  else if (supports.length === 1) subject = `${withArticle(supports[0])} ${noun}`;
  else subject = withArticle(noun);

  // 3. The TURN from the tension (the hinge). Skip if no real tension.
  let core = subject;
  if (o.tension && o.tension.strength > 0.4) {
    const tAxis = o.tension.axis as Axis;
    const aWord = pick(ADJ[tAxis][POS], seed, 3);
    const bWord = pick(ADJ[tAxis][NEG], seed, 5);
    const turn = pick(TURNS[reg], seed, 2).replace("{a}", aWord).replace("{b}", bWord);
    core = `${subject}, ${turn}`;
  }

  // 4. INFLECTION — a fast-cycle texture clause, occasionally, when present.
  if (o.inflection.length && (seed % 3 === 0)) {
    const inf = o.inflection[0];
    const infWord = pick(ADJ[inf.axis as Axis][inf.pole >= 0 ? POS : NEG], seed, 8);
    core = `${core}, ${infWord} in this hour`;
  }

  // 5. FRAME by register. If the core already carries a tension-turn, use a
  //    PLAIN frame (no {rest} clause) to avoid a double "and…" collision.
  //    Only the turn-less cores get the {rest}-style frames.
  const hasTurn = !!(o.tension && o.tension.strength > 0.4);
  const plainFrames: Record<Tone["register"], string[]> = {
    "warm-witness": ["{S}.", "{S} — a moment worth resting in."],
    "plain-reading": ["{S}.", "{S}, as things stand."],
    "quiet-riddle": ["{S}.", "{S} — make of it what you will."],
    "trickster-challenge": ["{S}. So — what will you do with it?", "{S}. Your move."],
  };
  const restFrames: Record<Tone["register"], string[]> = {
    "warm-witness": ["There's {s} — settled, clear for now.", "{S}. Nothing pulling hard — rest in it."],
    "plain-reading": ["The moment is {s} — clear, for now.", "{S}, and steady with it."],
    "quiet-riddle": ["Something in the hour is {s}; the rest stays unsaid.", "{S} — quiet, and holding."],
    "trickster-challenge": ["You've got {s} — clear and open. What will you make of it?", "{S}. The moment's yours; move."],
  };
  const framePool = hasTurn ? plainFrames[reg] : restFrames[reg];
  const frame = pick(framePool, seed, 4);
  const sentence = frame.replace("{S}", cap(core)).replace("{s}", core);

  return sentence;
}
