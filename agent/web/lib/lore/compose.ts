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
 * Names the CHORD (the result), not the inputs.
 */
export function distillTemplate(c: Composition): string {
  const topRes = c.resonances[0];
  const topTension = c.tensions[0];

  // Lead with the strongest coherent theme.
  const themeWords = c.activeQualities.slice(0, 3);
  let phrase = themeWords.length
    ? `A ${themeWords[0]}, ${themeWords[1]} quality`
    : "A quiet, in-between quality";

  if (topRes) {
    const w = poleWord(topRes.axis, topRes.pole);
    if (w) phrase += ` — ${w} and gathering`;
  }

  // If there's real tension, name the friction; it's what makes it true.
  if (topTension && topTension.strength > 0.5) {
    const hi = topTension.poles.reduce((a, b) => (a.value > b.value ? a : b));
    const lo = topTension.poles.reduce((a, b) => (a.value < b.value ? a : b));
    phrase += `, ${hi.name}'s ${poleWord(topTension.axis, hi.value)} wrestling with ${lo.name}'s ${poleWord(topTension.axis, lo.value)}`;
  }

  return phrase + ".";
}

/**
 * System + user prompt for the model-generated reading. Keep the system prompt
 * strict so the voice never drifts into horoscope cliché. The model gets the
 * COMPUTED composition — it names the chord, it does not invent the structure.
 */
export function buildPrompt(c: Composition): { system: string; user: string } {
  const system = [
    "You distill a moment's character from several cultural quality-systems into ONE sentence.",
    "You are given the COMPUTED composition: which qualities are active, where they resonate, where they pull against each other.",
    "Name the resulting character — the chord — NOT the input systems. Never list the signs or cards.",
    "One sentence. Evocative but grounded. No second person, no prediction, no advice, no 'you'.",
    "If there is tension, honor it — the friction is what makes it true. Do not smooth it into vague positivity.",
    "Never use: journey, energy, vibes, universe, manifest, align. Write like a poet, not a horoscope.",
  ].join(" ");

  const res = c.resonances[0];
  const ten = c.tensions[0];
  const user = [
    `Active qualities: ${c.activeQualities.join(", ")}.`,
    res ? `Strongest resonance: ${res.entries.join(" + ")} agree on being ${poleWord(res.axis, res.pole)} (${res.axis}).` : "No strong resonance.",
    ten ? `Strongest tension: on ${ten.axis}, ${ten.poles.map((p) => `${p.name} pulls ${poleWord(ten.axis, p.value)}`).join(" while ")}.` : "No strong tension.",
    "Distill this into one sentence naming the moment's character.",
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
