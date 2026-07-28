/**
 * COMPOSE — the distillation engine.
 * ----------------------------------------------------------------------------
 * Takes the qualia active RIGHT NOW (this sign, this animal, this phase, this
 * card) and composes them into the moment's character — not a list, a CHORD.
 *
 * The key move: because every quality is a POSITION on a RESONANCE polarity axis,
 * we can compute where the traditions AGREE (resonance — a strong shared theme)
 * and where they PULL AGAINST each other (tension — a felt friction). That
 * structure is what makes the reading feel true instead of generic. Fire + Leo +
 * waxing all push "active/warm/rising" → a coherent bright theme. Fixed Leo vs.
 * free Horse pull opposite on stable—changing → steadiness wrestling with the
 * urge to move. The chord contains a character no single system holds.
 *
 * Honesty: provenance rides along. The output can always be decomposed back to
 * "Leo contributed radiance, Horse contributed restlessness, and here they clash."
 * The distillation never erases which tradition said what.
 */

import type { QualiaEntry, Axis } from "./qualia";
import { AXES } from "./qualia";
import { momentPool, type QualiaEntry as QE } from "./qualia";
import { resolveHeritage, foregroundByLand, landCalendar, currentLandMoon } from "./geoHeritage";

export type AxisReading = {
  axis: string;
  /** Mean position across all contributing qualia, −1..+1. */
  mean: number;
  /** 0..1 — how tightly the qualia agree on this axis (1 = unanimous). */
  coherence: number;
  /** Which entries pushed which way — for the decomposition view. */
  contributors: { name: string; value: number; system: string }[];
};

export type Resonance = {
  axis: string;
  strength: number;              // 0..1, how strongly aligned
  pole: number;                  // the shared position, −1..+1
  entries: string[];             // names that agree here
};

export type Tension = {
  axis: string;
  strength: number;              // 0..1, how strongly opposed
  poles: { name: string; value: number; system: string }[];
};

export type Composition = {
  axes: AxisReading[];
  resonances: Resonance[];       // where the moment is coherent
  tensions: Tension[];           // where the moment is in friction
  activeQualities: string[];     // the union of all quality words, deduped
  contributors: QualiaEntry[];   // the source entries, for decomposition
};

/**
 * Compose the moment from its active qualia entries.
 *
 * Pure and deterministic — same inputs, same chord. The distilled sentence
 * (below) may be model-generated on top of this; the STRUCTURE is computed here
 * so the reading is always grounded in real positions, never invented.
 */
export function compose(active: QualiaEntry[]): Composition {
  // Gather every axis mentioned by any active entry.
  const axisMap = new Map<string, { value: number; name: string; system: string }[]>();
  for (const entry of active) {
    for (const axis of AXES) {
      const value = entry.polarities[axis];
      if (value === undefined) continue;
      if (!axisMap.has(axis)) axisMap.set(axis, []);
      axisMap.get(axis)!.push({ value, name: entry.name, system: entry.system });
    }
  }

  const axes: AxisReading[] = [];
  for (const [axis, contributors] of axisMap) {
    const values = contributors.map((c) => c.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // coherence: 1 minus the normalized spread. All same sign & close → high.
    const spread = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const coherence = Math.max(0, 1 - spread); // spread of 0 → 1; spread of 1 → 0
    axes.push({ axis, mean, coherence, contributors });
  }

  // Resonance: axes where ≥2 qualia agree strongly (high coherence, non-neutral mean).
  const resonances: Resonance[] = axes
    .filter((a) => a.contributors.length >= 2 && a.coherence > 0.6 && Math.abs(a.mean) > 0.3)
    .map((a) => ({
      axis: a.axis,
      strength: a.coherence * Math.abs(a.mean),
      pole: a.mean,
      entries: a.contributors.map((c) => c.name),
    }))
    .sort((x, y) => y.strength - x.strength);

  // Tension: axes where contributors split across the zero line with real distance.
  const tensions: Tension[] = axes
    .filter((a) => {
      const hi = Math.max(...a.contributors.map((c) => c.value));
      const lo = Math.min(...a.contributors.map((c) => c.value));
      return hi > 0.3 && lo < -0.3; // genuine opposition, not just mild difference
    })
    .map((a) => {
      const hi = Math.max(...a.contributors.map((c) => c.value));
      const lo = Math.min(...a.contributors.map((c) => c.value));
      return {
        axis: a.axis,
        strength: (hi - lo) / 2,
        poles: a.contributors.filter((c) => Math.abs(c.value) > 0.3),
      };
    })
    .sort((x, y) => y.strength - x.strength);

  const activeQualities = [...new Set(active.flatMap((e) => e.qualities))];

  return { axes, resonances, tensions, activeQualities, contributors: active };
}

/* ----------------------------------------------------------------------------
   DISTILLATION — two paths, as discussed.

   TEMPLATE path (below): deterministic, always tasteful, finite. Builds a phrase
   from the strongest resonance + strongest tension. Ships as the fallback and as
   the offline reading.

   MODEL path (buildPrompt): feed the composition to Claude for an infinite,
   responsive sentence. The system prompt is tight so tone never drifts; the
   template is the fallback if the call fails or the model returns a clunker.
   ---------------------------------------------------------------------------- */

const POLE_WORDS: Record<string, [string, string]> = {
  // axis → [negative-pole word (−1), positive-pole word (+1)]
  active:  ["receptive", "active"],
  rising:  ["falling", "rising"],
  steady:  ["restless", "steady"],
  warm:    ["cool", "warm"],
  outward: ["inward", "outward"],
  binding: ["dissolving", "binding"],
  gentle:  ["fierce", "gentle"],
  light:   ["shadowed", "bright"],
};

function poleWord(axis: string, value: number): string {
  const pair = POLE_WORDS[axis];
  if (!pair) return "";
  return value >= 0 ? pair[1] : pair[0];
}

/**
 * Deterministic distilled phrase — the offline / fallback reading.
 * Distills QUALITY WORDS from the mainframe chorus (how often they co-occur),
 * with axis poles as backup texture. Names NO system, sign, planet, animal,
 * or card — only the emergent weather. The character is the sum of all
 * contributors, not a report of which calendars are lit.
 */
export function distillTemplate(c: Composition): string {
  // Score mainframe quality words by how many chorus voices carry them.
  const qualityWeights = new Map<string, number>();
  for (const entry of c.contributors) {
    for (const q of entry.qualities) {
      const w = q.trim().toLowerCase();
      if (!w) continue;
      qualityWeights.set(w, (qualityWeights.get(w) ?? 0) + 1);
    }
  }
  const byShare = [...qualityWeights.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const shared = byShare.filter(([, n]) => n >= 2).map(([w]) => w);
  const fromQualities = (shared.length >= 2 ? shared : byShare.map(([w]) => w)).slice(0, 3);

  // Axis poles as secondary texture when qualities are thin.
  const leaning = c.axes
    .filter((a) => Math.abs(a.mean) > 0.25)
    .map((a) => ({ word: poleWord(a.axis, a.mean), weight: a.coherence * Math.abs(a.mean) }))
    .filter((x) => x.word)
    .sort((x, y) => y.weight - x.weight);

  const lead: string[] = [];
  for (const w of fromQualities) {
    if (!lead.includes(w)) lead.push(w);
    if (lead.length >= 3) break;
  }
  if (lead.length < 2) {
    for (const x of leaning) {
      if (!lead.includes(x.word)) lead.push(x.word);
      if (lead.length >= 3) break;
    }
  }

  let phrase =
    lead.length >= 2
      ? `A ${lead[0]}, ${lead[1]} quality`
      : lead.length === 1
      ? `A ${lead[0]} quality`
      : "A quiet, in-between quality";
  if (lead[2]) phrase += ` and ${lead[2]}`;

  // Counter-current = strongest tension, as felt weather — never which systems pull.
  const ten = c.tensions[0];
  if (ten && ten.strength > 0.4) {
    const hi = Math.max(...ten.poles.map((p) => p.value));
    const lo = Math.min(...ten.poles.map((p) => p.value));
    const pull = poleWord(ten.axis, hi);
    const counter = poleWord(ten.axis, lo);
    phrase += ` — ${pull} with a ${counter} current beneath`;
  }

  return phrase.replace(/ quality,/, ",").replace(/ quality and/, " and") + ".";
}

/**
 * System + user prompt for the model-generated reading. Keep the system prompt
 * strict so the voice never drifts into horoscope cliché. The model gets the
 * COMPUTED composition — it names the chord, it does not invent the structure.
 */
export function buildPrompt(c: Composition): { system: string; user: string } {
  const n = c.contributors.length;

  const system = [
    `This moment is read by ${n} independent traditions at once — cultures that never met, each observing the same instant and encoding a facet of its character.`,
    "Name the SINGLE character that emerges from ALL of them combined — the standing wave across the whole chorus, the quality they collectively point at.",
    "Do NOT name any system, sign, planet, animal, card, or tradition. Name the quality, never its sources.",
    "Do not build the sentence from one or two strong notes. The character is the SUM. If there is a dominant theme and a counter-current, hold both — but as one felt weather, not a list and not a duel.",
    "One sentence. Evocative but grounded. No second person, no 'you', no prediction, no advice.",
    "Never use: journey, energy, vibes, universe, manifest, align, cosmic. Write like a poet naming a weather, not a horoscope.",
  ].join(" ");

  // Pass the WHOLE shape: every axis reading, all resonances, all tensions —
  // as pure axis-language, never the tradition names (so the model can't leak them).
  const axisLines = c.axes
    .filter((a) => Math.abs(a.mean) > 0.2)
    .sort((a, b) => Math.abs(b.mean) * b.coherence - Math.abs(a.mean) * a.coherence)
    .map((a) => {
      const dir = poleWord(a.axis, a.mean);
      const agree = a.coherence > 0.66 ? "strongly shared" : a.coherence > 0.4 ? "broadly shared" : "mixed";
      return `  ${dir} (${a.axis}): ${agree}, ${n >= 1 ? a.contributors.length : 0} voices`;
    });

  const resLines = c.resonances.slice(0, 3).map(
    (r) => `  many traditions converge on ${poleWord(r.axis, r.pole)}`,
  );
  const tenLines = c.tensions.slice(0, 3).map((t) => {
    const hi = Math.max(...t.poles.map((p) => p.value));
    const lo = Math.min(...t.poles.map((p) => p.value));
    return `  a pull between ${poleWord(t.axis, hi)} and ${poleWord(t.axis, lo)}`;
  });

  const user = [
    `${n} traditions observe this moment. Their combined shape:`,
    "",
    "The moment leans (strongest first):",
    ...axisLines,
    "",
    resLines.length ? "Where the chorus agrees:" : "The chorus is evenly spread.",
    ...resLines,
    "",
    tenLines.length ? "Counter-currents (hold these, don't smooth them):" : "No strong counter-current.",
    ...tenLines,
    "",
    "All the qualities in play (already deduped across every tradition):",
    `  ${c.activeQualities.join(", ")}`,
    "",
    "Distill ALL of this into ONE sentence naming the moment's single emergent character. Name no tradition.",
  ].join("\n");

  return { system, user };
}

/**
 * The decomposition — for the "tap to see why" view. Traces the chord back to
 * each tradition's contribution, provenance intact. This is the honesty layer:
 * the user sees Leo gave radiance, Horse gave restlessness, and where they clash.
 */
export function decompose(c: Composition): {
  entry: QualiaEntry;
  contributes: string[];
}[] {
  return c.contributors.map((entry) => ({
    entry,
    contributes: entry.qualities,
  }));
}


/* ----------------------------------------------------------------------------
   WIRING — compose the live moment. Ties qualia + geo-heritage together.
   ---------------------------------------------------------------------------- */

/**
 * Given the entries active RIGHT NOW (resolved from the ephemeris + calendars —
 * see the Cursor brief for the resolver), compose the moment and order it
 * land-first for the user's coordinates.
 *
 * IMPORTANT: `activeNow` must be drawn from momentPool() only. Never pass a
 * cast or birth entry here — the home reading is computed-only by promise.
 */
export function composeMoment(
  activeNow: QE[],
  lat: number,
  lon: number,
  opts?: { localMonth?: number },
) {
  // Safety nets: home chord is computed-only AND render-honesty only.
  // foreground (Cherokee moons) and acknowledge traditions never score the chord.
  const forChord = activeNow.filter(
    (e) => e.nature === "computed" && e.honesty === "render",
  );
  const heritage = resolveHeritage(lat, lon);
  const ordered = foregroundByLand(forChord, heritage.regions);
  const chord = compose(ordered);
  const month = opts?.localMonth ?? new Date().getMonth() + 1;
  const currentMoon = currentLandMoon(heritage.regions, month);
  return {
    chord,
    ordered,
    heritage,
    landCalendar: currentMoon ? [currentMoon] : landCalendar(heritage.regions).slice(0, 1),
    acknowledgment: heritage.acknowledgment, // surfaced at the location fix
  };
}
