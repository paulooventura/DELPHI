/**
 * PHRASE — Delphi's local oracle voice. No API. No third-party dependency.
 * ----------------------------------------------------------------------------
 * Turns orchestration (root · tension · inflection · tone) into ONE sentence
 * that names the field and challenges the reader — every home phrase ends as
 * a dare. This is what the old model path was for; we own it on-device.
 *
 * Grammar (structure, not mush):
 *   WEATHER  — root axis → subject (the standing character of the moment)
 *   HINGE    — tension → the contradiction (never smoothed into positivity)
 *   HOUR     — fast-cycle inflection → how it shows up right now (optional)
 *   DARE     — register → the challenge to the reader (always second-person)
 *
 * Seeded from the moment's structure: same instant → same line; different
 * fields → different lines. Vocabulary pools below are authored — expand them
 * anytime for more variety; no regeneration needed.
 */

import type { Composition, Orchestration, Tone } from "./compose";
import { orchestrate } from "./compose";

type Axis =
  | "active"
  | "rising"
  | "steady"
  | "warm"
  | "outward"
  | "binding"
  | "gentle"
  | "light";

const POS = 1;
const NEG = -1;
const AXES: Axis[] = [
  "active", "rising", "steady", "warm", "outward", "binding", "gentle", "light",
];

function isAxis(s: string): s is Axis {
  return (AXES as string[]).includes(s);
}

/* ---- Authored vocabulary ------------------------------------------------- */

/** Root weather — full noun-phrases that already sound like a reading. */
const WEATHER: Record<Axis, Record<number, string[]>> = {
  warm: {
    [POS]: [
      "a warmth asking to be met",
      "a living heat in the field",
      "a glow that wants company",
    ],
    [NEG]: [
      "a cool distance in the air",
      "a chill that clears the noise",
      "a cold clarity settling in",
    ],
  },
  light: {
    [POS]: [
      "a brightness with nowhere to hide",
      "a clear light on what is",
      "an openness that leaves little shade",
    ],
    [NEG]: [
      "a dimming that won't name itself",
      "a veil over what seemed settled",
      "a shadow gathering at the edge",
    ],
  },
  active: {
    [POS]: [
      "a drive that won't sit still",
      "a surge pressing for a decision",
      "a momentum already under way",
    ],
    [NEG]: [
      "a hush that could tip either way",
      "a stillness holding its breath",
      "a quiet that is not empty",
    ],
  },
  rising: {
    [POS]: [
      "a swell building under the surface",
      "an ascent you can feel in the chest",
      "a crest forming whether you watch or not",
    ],
    [NEG]: [
      "a settling after something spent",
      "an ebb that asks what remains",
      "a descent into quieter ground",
    ],
  },
  steady: {
    [POS]: [
      "a hold that could become a stand",
      "a poise waiting for your weight",
      "a steadiness that will not argue",
    ],
    [NEG]: [
      "a restlessness under the calm",
      "a flux that refuses a neat story",
      "an unrest looking for a door",
    ],
  },
  outward: {
    [POS]: [
      "an outward pull toward contact",
      "a reaching that wants an answer",
      "an openness aimed at the world",
    ],
    [NEG]: [
      "a turning inward that needs listening",
      "a withdrawal with work still in it",
      "an inward lean asking for honesty",
    ],
  },
  binding: {
    [POS]: [
      "a gathering of loose ends",
      "a binding that wants a vow or a cut",
      "a structure pressing into form",
    ],
    [NEG]: [
      "a loosening of what was tight",
      "a release already under way",
      "a dissolution that frees a hand",
    ],
  },
  gentle: {
    [POS]: [
      "a tenderness that is still a force",
      "a soft pressure against the hard parts",
      "a grace that does not excuse you",
    ],
    [NEG]: [
      "a sharp edge asking for courage",
      "a fierceness that will not soften first",
      "a bite behind the polite face of the hour",
    ],
  },
};

/** Single-word colors for blending a support axis into the weather. */
const TINT: Record<Axis, Record<number, string[]>> = {
  warm:    { [POS]: ["warm", "sunlit"], [NEG]: ["cool", "austere"] },
  light:   { [POS]: ["bright", "lucid"], [NEG]: ["veiled", "dim"] },
  active:  { [POS]: ["urgent", "quickening"], [NEG]: ["slow", "held"] },
  rising:  { [POS]: ["rising", "cresting"], [NEG]: ["waning", "settling"] },
  steady:  { [POS]: ["steady", "rooted"], [NEG]: ["shifting", "unsettled"] },
  outward: { [POS]: ["open", "reaching"], [NEG]: ["inward", "withdrawn"] },
  binding: { [POS]: ["binding", "gathering"], [NEG]: ["loosening", "dissolving"] },
  gentle:  { [POS]: ["tender", "soft"], [NEG]: ["fierce", "cutting"] },
};

/** Tension hinge — {a}/{b} are opposing pole tints. The contradiction is the point. */
const HINGE: Record<Tone["register"], string[]> = {
  "warm-witness": [
    ", {a} on the face of it and {b} underneath",
    " — {a}, yet a {b} thread still runs",
    ", holding {a} without denying what is {b}",
  ],
  "plain-reading": [
    " — {a} on the surface, {b} below",
    ", {a} and quietly {b} at once",
    " — a live split between {a} and {b}",
  ],
  "quiet-riddle": [
    " — {a}, while something {b} has not spoken yet",
    ", {a} in plain sight, {b} in the unsaid",
    " — {a}, hiding a {b} turn",
  ],
  "trickster-challenge": [
    " — dealt as {a}, already leaning toward {b}",
    ", {a} in one hand and {b} in the other",
    " — {a} while {b} strains against it; it will not stay put",
  ],
};

/** Fast-hour texture — words that work after "is" / "already" / "leans". */
const HOUR_FEEL: Record<Axis, Record<number, string[]>> = {
  warm:    { [POS]: ["warm", "heated"], [NEG]: ["cool", "austere"] },
  light:   { [POS]: ["lucid", "exposed"], [NEG]: ["veiled", "dim"] },
  active:  { [POS]: ["urgent", "restless"], [NEG]: ["slow", "hushed"] },
  rising:  { [POS]: ["rising", "cresting"], [NEG]: ["waning", "settling"] },
  steady:  { [POS]: ["steady", "planted"], [NEG]: ["unsettled", "mobile"] },
  outward: { [POS]: ["outward", "reaching"], [NEG]: ["inward", "withdrawn"] },
  binding: { [POS]: ["tightening", "gathering"], [NEG]: ["loosening", "releasing"] },
  gentle:  { [POS]: ["tender", "soft"], [NEG]: ["fierce", "sharp"] },
};

/** Fast-hour texture. */
const HOUR: string[] = [
  ", and the hour itself feels {tint}",
  ", leaning {tint} in the near cycles",
  ", the immediate sky already {tint}",
];

/**
 * The turn to the reader — always a challenge (imperative, second-person).
 * Weather names the field; the dare makes it the user's move.
 */
const DARE: Record<Tone["register"], string[]> = {
  "warm-witness": [
    " Stay with it — will you notice what softens before you leave?",
    " Don't reach for the next thing. Let this land. Prove you can.",
    " Meet it without improving it. That is the challenge.",
  ],
  "plain-reading": [
    " Name which side you are feeding — then choose on purpose.",
    " Don't pretend both poles can lead. Pick the one you will answer.",
    " See the split cleanly, then take one honest step. Now.",
  ],
  "quiet-riddle": [
    " Sit with what stays unsaid until it points — don't look away.",
    " The answer is waiting for your attention. Will you give it?",
    " Turn it over once more before you move. That is your task.",
  ],
  "trickster-challenge": [
    " So — which hand do you play?",
    " The moment is on the table. Your move.",
    " What will you do with a field that will not sit still?",
    " Don't watch both doors; walk through one.",
    " You've been dealt this. Act like it matters.",
  ],
};

const EMPTY: string[] = [
  "An even field — nothing pulling hard. What were you avoiding while it was quiet?",
  "A still point between currents. Decide before the next surge arrives — that is the dare.",
  "No strong lean either way. Rare. Plant one clear intention while you can.",
];

/* ---- Seeded pick (deterministic per moment) ------------------------------ */

function seedFrom(o: Orchestration): number {
  const r = o.root
    ? o.root.axis.charCodeAt(0) * 7 + Math.round(o.root.pole * 100) + o.root.axis.length * 3
    : 0;
  const t = o.tension
    ? o.tension.axis.charCodeAt(0) * 13 + Math.round(o.tension.strength * 100)
    : 0;
  const i = o.inflection[0]
    ? o.inflection[0].axis.length * 11 + Math.round(o.inflection[0].pole * 50)
    : 0;
  const tone =
    Math.round(o.tone.warmth * 40) +
    Math.round(o.tone.clarity * 40) +
    Math.round(o.tone.charge * 60);
  return Math.abs(r * 31 + t * 17 + i * 23 + tone * 5 + o.fieldSize * 9) % 9973;
}

function pick<T>(arr: T[], seed: number, salt: number): T {
  return arr[Math.abs(seed + salt * 17) % arr.length]!;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function poleOf(n: number): number {
  return n >= 0 ? POS : NEG;
}

/* ---- Assembly ------------------------------------------------------------ */

function weatherLine(o: Orchestration, c: Composition, seed: number): string {
  if (!o.root || !isAxis(o.root.axis)) {
    return pick(EMPTY, seed, 0).split(".")[0]!.toLowerCase();
  }
  const pole = poleOf(o.root.pole);
  let weather = pick(WEATHER[o.root.axis][pole], seed, 1);

  // Tint with one supporting axis if it is strong and distinct.
  const support = c.axes
    .filter(a => a.axis !== o.root!.axis && isAxis(a.axis) && Math.abs(a.mean) > 0.35)
    .sort((a, b) => Math.abs(b.mean) * b.coherence - Math.abs(a.mean) * a.coherence)[0];

  if (support && isAxis(support.axis) && seed % 2 === 0) {
    const tint = pick(TINT[support.axis][poleOf(support.mean)], seed, 2);
    // Weave tint without stacking into "a rising, bright warmth" mush.
    if (!weather.includes(tint)) {
      const article = /^[aeiou]/i.test(tint) ? "an " : "a ";
      weather = weather.replace(/^an? /, `${article}${tint} `);
    }
  }
  return weather;
}

function hingeClause(o: Orchestration, seed: number): string {
  if (!o.tension || o.tension.strength < 0.4 || !isAxis(o.tension.axis)) return "";
  const axis = o.tension.axis;
  const a = pick(TINT[axis][POS], seed, 3);
  const b = pick(TINT[axis][NEG], seed, 5);
  return pick(HINGE[o.tone.register], seed, 4)
    .replace("{a}", a)
    .replace("{b}", b);
}

function hourClause(o: Orchestration, seed: number): string {
  // Always include inflection when present and charge is mid/high — the "now."
  if (!o.inflection.length) return "";
  if (o.tone.charge < 0.35 && seed % 3 !== 0) return "";
  const inf = o.inflection[0]!;
  if (!isAxis(inf.axis)) return "";
  const tint = pick(HOUR_FEEL[inf.axis][poleOf(inf.pole)], seed, 8);
  return pick(HOUR, seed, 9).replace("{tint}", tint);
}

function dareLine(reg: Tone["register"], seed: number): string {
  return pick(DARE[reg], seed, 11);
}

/**
 * Produce the distilled sentence from a composition — locally, no API.
 * Names the chord, honors the tension, turns to the reader.
 */
export function speak(c: Composition): string {
  const o = orchestrate(c);
  const seed = seedFrom(o);

  if (!o.root) {
    return pick(EMPTY, seed, 0);
  }

  const weather = weatherLine(o, c, seed);
  const hinge = hingeClause(o, seed);
  const hour = hourClause(o, seed);
  const dare = dareLine(o.tone.register, seed);

  // One breathing sentence: weather + hinge + hour, then the dare as its own beat.
  // Avoid double periods / awkward "a a" from templates.
  const body = `${cap(weather)}${hinge}${hour}.`.replace(/\.\./g, ".");
  const line = `${body}${dare}`.replace(/\s+/g, " ").trim();

  // Guarantee a terminal mark on the dare (templates include it).
  return /[.!?]$/.test(line) ? line : `${line}.`;
}
