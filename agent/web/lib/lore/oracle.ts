/**
 * The Pythia's answer (Paulo 11-11, staging/delphi/FEEDBACK-2026-11-11.md "Oracle formula").
 * ----------------------------------------------------------------------------
 * One shared space of themes: the eight polarity axes every qualia entry already carries. Three sources map onto
 * it: the birth chart (person entries), the casts the person drew and kept (newer weigh more), and the moment the
 * button was pressed. Mix 0.4 / 0.3 / 0.3 (re-weighted over the sources present). The strongest axis is what the
 * question is really about; the next strongest is the trap; how much of the pull sits on that one axis is how
 * sure the answer sounds.
 * The question's words only choose phrasing, never the verdict, and nothing leaves the device.
 * No dice: the same question at the same minute gives the same answer.
 */

import { AXES, type Axis, type QualiaEntry } from "./qualia";

export type OracleSource = "birth" | "cast" | "moment";

export type OracleCast = { at: string; names: string[]; entries: QualiaEntry[] };

export type OracleInput = {
  person: QualiaEntry[];
  casts: OracleCast[];
  moment: QualiaEntry[];
  question: string;
  atMs: number;
};

export type OracleWeight = { source: OracleSource; name: string; glyph: string; share: number };

export type OracleAnswer = {
  line: string;
  /** A Delphic maxim, or a question back when the reading is unsure. */
  coda: string;
  codaIsQuestion: boolean;
  axis: Axis;
  pole: 1 | -1;
  trap: Axis;
  trapPole: 1 | -1;
  /** 0 (torn) … 1 (one clear pull). */
  certainty: number;
  /** The three inputs that weighed most on the answer's axis. */
  working: OracleWeight[];
  sources: Record<OracleSource, number>;
};

export const ORACLE_MIX: Record<OracleSource, number> = { birth: 0.4, cast: 0.3, moment: 0.3 };

/** How fast an older kept cast fades: half its weight per week. */
const CAST_HALF_LIFE_DAYS = 7;

/** Each pole as a verb (base and -ing) so templates can speak it. */
const POLE: Record<Axis, { pos: [string, string]; neg: [string, string] }> = {
  active: { pos: ["act first", "acting first"], neg: ["wait", "waiting"] },
  rising: { pos: ["rise", "rising"], neg: ["settle", "settling"] },
  steady: { pos: ["hold your ground", "holding your ground"], neg: ["let it change", "letting it change"] },
  warm: { pos: ["burn", "burning"], neg: ["cool", "cooling"] },
  outward: { pos: ["go out to meet it", "going out to meet it"], neg: ["turn inward", "turning inward"] },
  binding: { pos: ["bind it fast", "binding it fast"], neg: ["let go", "letting go"] },
  gentle: { pos: ["yield", "yielding"], neg: ["force it", "forcing it"] },
  light: { pos: ["bring it into the light", "bringing it into the light"], neg: ["keep it hidden", "keeping it hidden"] },
};

const LINES: ((a: [string, string], b: [string, string]) => string)[] = [
  a => `If you ${a[0]}, something great will fall. Ask first whose it is.`,
  (a, b) => `${cap(a[1])} opens the gate. ${cap(b[1])} is the gate.`,
  (a, b) => `The one who would ${a[0]} must first ${b[0]}; the one who cannot ${b[0]} will ${a[0]} alone.`,
  (a, b) => `${cap(a[1])} wins the day; ${b[1]} wins the year. You will be asked to choose only once.`,
  (a, b) => `Go, and ${a[0]}. But the road home is another road, unless you ${b[0]}.`,
  (a, b) => `What you gain by ${a[1]} you keep by ${b[1]}. Mistake one for the other and both are lost.`,
];

const QUESTIONS: ((a: [string, string], b: [string, string]) => string)[] = [
  (a, b) => `Which of the two do you call yours: to ${a[0]}, or to ${b[0]}?`,
  a => `Would you still ${a[0]} if no one were watching?`,
  (a, b) => `What would you lose if you chose to ${b[0]}?`,
];

/** A few of the Delphic maxims (Stobaeus' list; the Greek is public domain, the English renderings are ours). */
export const DELPHIC_MAXIMS: readonly string[] = [
  "Know thyself.",
  "Nothing in excess.",
  "Know the right moment.",
  "Give a pledge, and ruin is near.",
  "Think as a mortal.",
  "Rule your temper.",
  "Hold to what is yours.",
  "Keep your eyes on the end.",
  "Do not tire of learning.",
  "Use your skill.",
  "Speak well of everyone.",
  "Be afraid of no one's anger but your own.",
  "Watch what is yours.",
  "Act without regret.",
  "Restrain the tongue.",
  "Accept your fate.",
  "Respect yourself.",
  "Pursue what is honourable.",
];

/** Below this the answer turns into a question back. */
const UNSURE = 0.28;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Small stable hash (FNV-1a) for picking phrasing. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Weighted = { source: OracleSource; entry: QualiaEntry; w: number };

function weighted(input: OracleInput): Weighted[] {
  const out: Weighted[] = [];
  const present: OracleSource[] = [];
  if (input.person.length) present.push("birth");
  const casts = input.casts.filter(c => c.entries.length);
  if (casts.length) present.push("cast");
  if (input.moment.length) present.push("moment");
  const total = present.reduce((s, k) => s + ORACLE_MIX[k], 0) || 1;
  const share = (k: OracleSource) => ORACLE_MIX[k] / total;

  for (const e of input.person) out.push({ source: "birth", entry: e, w: share("birth") / input.person.length });
  for (const e of input.moment) out.push({ source: "moment", entry: e, w: share("moment") / input.moment.length });
  if (casts.length) {
    const ages = casts.map(c => {
      const t = Date.parse(c.at);
      const days = Number.isFinite(t) ? Math.max(0, (input.atMs - t) / 86_400_000) : 30;
      return 0.5 ** (days / CAST_HALF_LIFE_DAYS);
    });
    const sum = ages.reduce((s, x) => s + x, 0) || 1;
    casts.forEach((c, i) => {
      for (const e of c.entries) out.push({ source: "cast", entry: e, w: (share("cast") * ages[i]!) / sum / c.entries.length });
    });
  }
  return out;
}

export function askOracle(input: OracleInput): OracleAnswer {
  const items = weighted(input);
  const vec = Object.fromEntries(AXES.map(a => [a, 0])) as Record<Axis, number>;
  for (const it of items) for (const a of AXES) vec[a] += (it.entry.polarities[a] ?? 0) * it.w;

  const ranked = [...AXES].sort((x, y) => Math.abs(vec[y]) - Math.abs(vec[x]) || AXES.indexOf(x) - AXES.indexOf(y));
  const axis = ranked[0]!;
  const trap = ranked[1]!;
  const pole: 1 | -1 = vec[axis] >= 0 ? 1 : -1;
  // The trap is the pull of the second axis, spoken from the side that works against the first.
  const trapPole: 1 | -1 = vec[trap] >= 0 ? 1 : -1;
  // How sure: how much of the whole pull sits on the one axis (an even spread over all eight = torn).
  const top = Math.abs(vec[axis]);
  const spread = AXES.reduce((s, x) => s + Math.abs(vec[x]), 0);
  const certainty = top < 1e-6 ? 0 : Math.max(0, Math.min(1, 2.5 * (top / spread) - 0.25));

  const a = pole === 1 ? POLE[axis].pos : POLE[axis].neg;
  const b = trapPole === 1 ? POLE[trap].pos : POLE[trap].neg;
  // Phrasing seed: the question's words and the minute it was asked. The verdict above never depends on it.
  const words = input.question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).join(" ");
  const seed = hash(`${words}|${Math.floor(input.atMs / 60_000)}`);
  const line = LINES[seed % LINES.length]!(a, b);
  const codaIsQuestion = certainty < UNSURE;
  const coda = codaIsQuestion
    ? QUESTIONS[(seed >>> 8) % QUESTIONS.length]!(a, b)
    : DELPHIC_MAXIMS[(seed >>> 8) % DELPHIC_MAXIMS.length]!;

  const sources: Record<OracleSource, number> = { birth: 0, cast: 0, moment: 0 };
  for (const it of items) sources[it.source] += it.w;

  const pull = new Map<string, OracleWeight>();
  for (const it of items) {
    const v = (it.entry.polarities[axis] ?? 0) * pole * it.w;
    if (v <= 0) continue;
    const key = `${it.source}|${it.entry.id}`;
    const prev = pull.get(key);
    if (prev) prev.share += v;
    else pull.set(key, { source: it.source, name: it.entry.name, glyph: it.entry.glyph, share: v });
  }
  const sumPull = [...pull.values()].reduce((s, x) => s + x.share, 0) || 1;
  const working = [...pull.values()]
    .sort((x, y) => y.share - x.share)
    .slice(0, 3)
    .map(w => ({ ...w, share: w.share / sumPull }));

  return { line, coda, codaIsQuestion, axis, pole, trap, trapPole, certainty, working, sources };
}

/** Plain words for an axis pole, for the "how this was weighed" fold. */
export function poleName(axis: Axis, pole: 1 | -1): string {
  return (pole === 1 ? POLE[axis].pos : POLE[axis].neg)[1];
}
