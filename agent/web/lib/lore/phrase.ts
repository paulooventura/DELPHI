/**
 * PHRASE — Delphi's local oracle voice. No API. No third-party dependency.
 * ----------------------------------------------------------------------------
 * Turns orchestration (root · tension · inflection · tone) into ONE reading
 * that names the field and challenges the reader — every home phrase ends as
 * a dare. Offline fallback for the phrase brain; we own this path on-device.
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

import type { Composition, DistillOptions, Orchestration, Tone } from "./compose";
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
 * The turn to the reader — short enough to sit between the taijitu dots.
 */
const DARE: Record<Tone["register"], string[]> = {
  "warm-witness": [
    " Stay with it. Your call.",
    " Let it land on you.",
    " Meet it. Don't improve it.",
  ],
  "plain-reading": [
    " Name the pole you'll answer.",
    " Pick one side.",
    " Choose on purpose.",
  ],
  "quiet-riddle": [
    " Don't look away.",
    " Sit with the unsaid.",
    " Give it your attention.",
  ],
  "trickster-challenge": [
    " Your move.",
    " Walk through one door.",
    " Act like it matters.",
  ],
};

const EMPTY: string[] = [
  "An even field. Decide while it's quiet.",
  "A still point. Plant one intention.",
  "Nothing pulling hard. What will you do?",
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
  // Fast cycles are the hour's texture — include them whenever they vote.
  if (!o.inflection.length) return "";
  const inf = o.inflection[0]!;
  if (!isAxis(inf.axis)) return "";
  const tint = pick(HOUR_FEEL[inf.axis][poleOf(inf.pole)], seed, 8);
  return pick(HOUR, seed, 9).replace("{tint}", tint);
}

function dareLine(reg: Tone["register"], seed: number): string {
  return pick(DARE[reg], seed, 11);
}

/**
 * Distilled line for the home orb — weather + hinge + hour + dare.
 * Local fallback when the phrase brain is offline. Wraps between the dots.
 */
export function speak(c: Composition, opts?: DistillOptions): string {
  const o = orchestrate(c);
  const seed = seedFrom(o);

  if (!o.root) {
    return pick(EMPTY, seed, 0);
  }

  const weather = weatherLine(o, c, seed);
  const hinge = hingeClause(o, seed);
  const hour = hourClause(o, seed);
  const dare = dareLine(o.tone.register, seed);
  let body = `${cap(weather)}${hinge}${hour}`;

  const held = (opts?.castLean ?? [])
    .map(q => q.trim().toLowerCase())
    .filter(q => q.length > 1 && !body.toLowerCase().includes(q))
    .slice(0, 2);
  if (held.length === 2) body += `, with ${held[0]} and ${held[1]} held beneath`;
  else if (held.length === 1) body += `, with ${held[0]} held beneath`;

  const line = `${body}.${dare}`.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(line) ? line : `${line}.`;
}
