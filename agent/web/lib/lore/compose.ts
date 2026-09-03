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

import type { QualiaEntry, Axis, Polarities } from "./qualia";
import { AXES } from "./qualia";
import { momentPool, type QualiaEntry as QE } from "./qualia";
import { resolveHeritage, foregroundByLand, landCalendar, currentLandMoon } from "./geoHeritage";
import {
  COLOR_LEAN_BOOST,
  COLOR_QUALITY_LEAN,
  colorLeanMatches,
  type TribeColor,
} from "./colorLean";

export type DistillVoice =
  | "field"
  | "warm-witness"
  | "plain-reading"
  | "quiet-riddle"
  | "trickster-challenge";

export type DistillOptions = {
  /** Natal tribe color lean — reweights qualities already in the chorus. */
  colorLean?: TribeColor;
  /**
   * Qualities from an embraced cast (local). Soft-boosts / admits them into the
   * street phrase lean — never as chord contributors to composeMoment.
   */
  castLean?: string[];
  /**
   * Mouth of the reading. "field" lets orchestration pick the register.
   * Any other value changes VOICE only — never the chord.
   */
  voice?: DistillVoice;
};

/** Soft natal bias on axis ranking for the offline template. */
const COLOR_LEAN_BIAS = 0.35;

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
   DISTILLATION — two paths (Addendum 4 / ORCHESTRATION.md).

   TEMPLATE path (distillTemplate): deterministic noun-based offline fallback.
   MODEL path (orchestratedPrompt): root / tension / inflection / register —
   the primary home-phrase call. buildPrompt remains for lean-hint tooling.
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
 * Names the moment as a NOUN with 1–2 adjectives (grammatical article agreement).
 * Names NO system, sign, planet, animal, or card — only emergent weather.
 *
 * Optional `colorLean` / `castLean` retune which axes lead / add an undercurrent.
 */
export function distillTemplate(c: Composition, opts?: DistillOptions): string {
  const castLeanList = (opts?.castLean ?? [])
    .map(q => q.trim().toLowerCase())
    .filter(Boolean);

  // Soft natal bias: nudge axes whose pole words sit in the color register.
  const colorBoost = new Map<string, number>();
  if (opts?.colorLean) {
    const words = new Set(COLOR_QUALITY_LEAN[opts.colorLean].map(w => w.toLowerCase()));
    for (const axis of Object.keys(POLE_WORDS)) {
      const [neg, pos] = POLE_WORDS[axis]!;
      if (words.has(pos)) colorBoost.set(axis, COLOR_LEAN_BIAS);
      else if (words.has(neg)) colorBoost.set(axis, -COLOR_LEAN_BIAS);
      else if ([...words].some(w => colorLeanMatches(w, opts.colorLean!))) {
        // Quality-register overlap without exact pole word — slight positive nudge.
        if (axis === "warm" || axis === "light" || axis === "active") {
          colorBoost.set(axis, COLOR_LEAN_BIAS * 0.5);
        }
      }
    }
  }

  const leaning = c.axes
    .filter(a => Math.abs(a.mean) > 0.25)
    .map(a => {
      const bias = colorBoost.get(a.axis) ?? 0;
      const mean = a.mean + bias;
      return {
        axis: a.axis,
        word: poleWord(a.axis, mean),
        mean,
        weight: a.coherence * Math.abs(mean) + Math.abs(bias),
      };
    })
    .filter(x => x.word)
    .sort((x, y) => y.weight - x.weight);

  const NOUN: Record<string, string> = {
    warm: "warmth", light: "brightness", active: "drive", rising: "ascent",
    steady: "steadiness", outward: "openness", binding: "structure", gentle: "tenderness",
  };
  const NOUN_NEG: Record<string, string> = {
    warm: "coolness", light: "dimness", active: "stillness", rising: "settling",
    steady: "restlessness", outward: "inwardness", binding: "dissolution", gentle: "sharpness",
  };

  if (leaning.length === 0) {
    let quiet = "A quiet, in-between moment, poised between currents.";
    if (castLeanList.length > 0) {
      const held = castLeanList.slice(0, 2);
      quiet = quiet.replace(/\.$/, held.length === 2
        ? `, with ${held[0]} and ${held[1]} held beneath.`
        : `, with ${held[0]} held beneath.`);
    }
    return quiet;
  }

  const top = leaning[0]!;
  const noun = (top.mean >= 0 ? NOUN : NOUN_NEG)[top.axis] ?? "quality";
  const adjs = leaning.slice(1, 3).map(x => x.word);
  const withArticle = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

  let phrase: string;
  if (adjs.length === 2) {
    phrase = `${cap(withArticle(adjs[0]!))}, ${adjs[1]} ${noun}`;
  } else if (adjs.length === 1) {
    phrase = `${cap(withArticle(adjs[0]!))} ${noun}`;
  } else {
    phrase = `${cap(withArticle(top.word))} ${noun}`;
  }

  const ten = c.tensions[0];
  if (ten && ten.strength > 0.45) {
    const lo = Math.min(...ten.poles.map(p => p.value));
    const counter = poleWord(ten.axis, lo);
    phrase += `, with a ${counter} current beneath`;
  }

  if (castLeanList.length > 0) {
    const held = castLeanList.slice(0, 2);
    const glue = phrase.includes(", with a ") ? "; " : ", ";
    if (held.length === 2) phrase += `${glue}with ${held[0]} and ${held[1]} held beneath`;
    else phrase += `${glue}with ${held[0]} held beneath`;
  } else if (opts?.colorLean) {
    const tint = COLOR_QUALITY_LEAN[opts.colorLean]
      .map(w => w.toLowerCase())
      .find(w => !phrase.toLowerCase().includes(w));
    if (tint) phrase += `, tinged with ${tint}`;
  }

  return `${phrase}.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * System + user prompt for the model-generated reading. Keep the system prompt
 * strict so the voice never drifts into horoscope cliché. The model gets the
 * COMPUTED composition — it names the chord, it does not invent the structure.
 */
export function buildPrompt(c: Composition, opts?: DistillOptions): { system: string; user: string } {
  const n = c.contributors.length;

  const system = [
    `This moment is read by ${n} independent traditions at once — cultures that never met, each observing the same instant and encoding a facet of its character.`,
    "Name the SINGLE character that emerges from ALL of them combined — the standing wave across the whole chorus, the quality they collectively point at.",
    "Do NOT name any system, sign, planet, animal, card, or tradition. Name the quality, never its sources.",
    "Do not build the sentence from one or two strong notes. The character is the SUM. If there is a dominant theme and a counter-current, hold both — but as one felt weather, not a list and not a duel.",
    "One sentence. Evocative but grounded. No second person, no 'you', no prediction, no advice.",
    "Never use: journey, energy, vibes, universe, manifest, align, cosmic. Write like a poet naming a weather, not a horoscope.",
    "Never name colors (red, white, blue, yellow) or kin labels — only felt weather.",
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

  const leanHint = opts?.colorLean
    ? [
        "",
        "Personal register (natal — MUST color the weather; never name the color itself):",
        `  Lean the sentence toward: ${COLOR_QUALITY_LEAN[opts.colorLean].slice(0, 8).join(", ")}.`,
        "  Do not name any color or kin label.",
      ]
    : [];

  const castHint =
    opts?.castLean && opts.castLean.length > 0
      ? [
          "",
          "Held cast (user embraced — MUST fold as undercurrent weather, never name the card/rune/system):",
          `  Weave in: ${opts.castLean.slice(0, 8).join(", ")}.`,
        ]
      : [];

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
    ...leanHint,
    ...castHint,
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


/* ----------------------------------------------------------------------------
   LAYERS — the living moment phrase (Addendum 2).
   Each layer re-composes live via compose(). Dropping a layer returns the one
   beneath it UNCHANGED — because we never mutate the layers below, we rebuild
   from the entry sets each time. Freshness comes from real inputs (the sky
   rolling over, birth data added, a card drawn), never from a timer or churn.
   ---------------------------------------------------------------------------- */

export type LayerId = "moment" | "through-you" | "with-drawn";

export type ReadingLayer = {
  id: LayerId;
  label: string;                 // what the user sees — names exactly what's in it
  entries: QE[];                 // the cumulative entry set composed for this layer
  chord: Composition;
  /** the entries THIS layer added on top of the one below (for transparency) */
  added: QE[];
};

export type LayeredReading = {
  layers: ReadingLayer[];        // [moment] or [moment, through-you] or all three
  active: LayerId;               // which layer the user is currently reading
};

/**
 * Build the available reading layers from what the user has revealed.
 *
 * - `moment` is ALWAYS present and ALWAYS computed-only (the invariant).
 * - `through-you` appears only if `natal` entries are supplied (birth data set).
 * - `with-drawn` appears only if `drawn` entries are supplied (a cast happened).
 *
 * The caller decides which layer is `active` (the user's choice). Nothing here
 * changes on a timer — call this again only when the inputs actually change:
 * the sky rolls over (new `moment`), birth data is added (`natal`), a card is
 * drawn (`drawn`), or the user clears a layer.
 */
export function composeLayers(
  moment: QE[],
  opts: { natal?: QE[]; drawn?: QE[]; active?: LayerId } = {},
): LayeredReading {
  // Layer 0 — pure moment. Enforce computed-only regardless of what's passed.
  const m = moment.filter((e) => e.nature === "computed");
  const layers: ReadingLayer[] = [
    { id: "moment", label: "The moment", entries: m, chord: compose(m), added: [] },
  ];

  // Layer 1 — through you (natal qualities folded in).
  if (opts.natal && opts.natal.length) {
    const natal = opts.natal.filter((e) => e.nature !== "cast"); // natal, not draws
    const entries = [...m, ...natal];
    layers.push({
      id: "through-you",
      label: "The moment, through you",
      entries,
      chord: compose(entries),
      added: natal,
    });
  }

  // Layer 2 — with what you drew (cast entries folded onto the top layer so far).
  if (opts.drawn && opts.drawn.length) {
    const base = layers[layers.length - 1]!.entries; // fold onto whatever's on top
    const drawn = opts.drawn.filter((e) => e.nature === "cast");
    const entries = [...base, ...drawn];
    layers.push({
      id: "with-drawn",
      label:
        layers.length > 1
          ? "The moment, through you, coloured by what you drew"
          : "The moment, coloured by what you drew",
      entries,
      chord: compose(entries),
      added: drawn,
    });
  }

  // Default active layer = the deepest available, unless the user chose one.
  const available = layers.map((l) => l.id);
  const active =
    opts.active && available.includes(opts.active)
      ? opts.active
      : layers[layers.length - 1]!.id;

  return { layers, active };
}

/** The phrase for whichever layer is active — orchestrated voice (Addendum 4). */
export function layerPrompt(reading: LayeredReading): { system: string; user: string } {
  const layer = reading.layers.find((l) => l.id === reading.active)!;
  return orchestratedPrompt(layer.chord);
}


/* ----------------------------------------------------------------------------
   SNAPSHOT — the moment phrase locks when the home screen opens (Addendum 3).
   The clock spins live; the PHRASE is a still reading of the arrival instant.
   Call takeSnapshot once on home-open / return — never on a timer, never per render.
   ---------------------------------------------------------------------------- */

export type MomentSnapshot = {
  takenAt: number;               // epoch ms — when the home screen opened
  chord: Composition;
  ordered: QE[];                 // land-first ordered contributors
  phrase?: string;               // filled by the caller (model or template)
  measuredCount: number;         // how many measured-tier voices (the honest core)
  celebratedCount: number;       // how many celebrated-tier voices (the chorus)
  heritage: ReturnType<typeof resolveHeritage>;
  landCalendar: QE[];
  acknowledgment: ReturnType<typeof resolveHeritage>["acknowledgment"];
};

/**
 * Take the snapshot. Call ONCE when home opens (and again on return).
 * `activeNow` should include slow rings AND sub-day rings from resolveMoment.
 */
export function takeSnapshot(activeNow: QE[], lat: number, lon: number): MomentSnapshot {
  // Computed-only + render-honesty — foreground/acknowledge never score the chord.
  const computed = activeNow.filter(
    (e) => e.nature === "computed" && e.honesty === "render",
  );
  const heritage = resolveHeritage(lat, lon);
  const ordered = foregroundByLand(computed, heritage.regions);
  const chord = compose(ordered);
  const month = new Date().getMonth() + 1;
  const currentMoon = currentLandMoon(heritage.regions, month);
  return {
    takenAt: Date.now(),
    chord,
    ordered,
    measuredCount: computed.filter((e) => e.tier === "measured").length,
    celebratedCount: computed.filter((e) => e.tier === "celebrated").length,
    heritage,
    landCalendar: currentMoon ? [currentMoon] : landCalendar(heritage.regions).slice(0, 1),
    acknowledgment: heritage.acknowledgment,
  };
}

/**
 * Optional sub-day blend — scale incoming polarities by weight before composing.
 * Locked snapshots don't need this; kept for a breathing variant.
 */
export function blendTransition(
  current: QE[],
  incoming: { entry: QE; weight: number }[],
): Composition {
  const scaled: QE[] = incoming.map(({ entry, weight }) => ({
    ...entry,
    polarities: Object.fromEntries(
      Object.entries(entry.polarities).map(([k, v]) => [k, (v as number) * weight]),
    ) as Polarities,
  }));
  return compose([...current, ...scaled]);
}

/**
 * Tier-honest provenance for "tap to see why":
 * "computed from N measured positions, celebrated through M cultural traditions."
 */
export function provenance(snap: MomentSnapshot): {
  measured: QE[];
  celebrated: QE[];
  line: string;
} {
  const measured = snap.ordered.filter((e) => e.tier === "measured");
  const celebrated = snap.ordered.filter((e) => e.tier === "celebrated");
  const line =
    `Computed from ${measured.length} measured position${measured.length === 1 ? "" : "s"}, ` +
    `celebrated through ${celebrated.length} cultural tradition${celebrated.length === 1 ? "" : "s"}.`;
  return { measured, celebrated, line };
}


/* ============================================================================
   ORCHESTRATION — the definitive moment reading (Addendum 4 / ORCHESTRATION.md).
   ============================================================================
   ROOT = depth-weighted whole-field consensus (slow cycles key).
   TENSION = deepest genuine split (the turn).
   INFLECTION = fast cycles only (texture).
   TONE/REGISTER = computed from the same field — voice is a reading, not a setting.
*/

/** Approximate cycle length in seconds — slow keys the reading; fast inflects. */
const CYCLE_SECONDS: Record<string, number> = {
  "vedic-sidereal": 365 * 86400,
  "western-zodiac": 30 * 86400,
  "egyptian-decan": 10 * 86400,
  "chinese-animal": 365 * 86400,
  wuxing: 365 * 86400,
  nakshatra: 86400,
  "tzolkin-daysign": 20 * 86400,
  "tzolkin-tone": 13 * 86400,
  "pawukon-wuku": 7 * 86400,
  "anwa-manzil": 86400,
  "cherokee-moon": 30 * 86400,
  "moon-phase": (29.53 * 86400) / 8,
  element: 365 * 86400,
  pancawara: 5 * 86400,
  "planetary-day": 86400,
  numerology: 86400,
  "planetary-hour": 3600,
  "chinese-shi": 7200,
  muhurta: 2880,
};

function depthWeight(system: string): number {
  const secs = CYCLE_SECONDS[system] ?? 86400;
  return Math.log10(secs + 10);
}

function isFast(system: string): boolean {
  return (CYCLE_SECONDS[system] ?? 86400) <= 7200;
}

export type Tone = {
  gentleness: number;
  clarity: number;
  warmth: number;
  charge: number;
  register: "warm-witness" | "plain-reading" | "quiet-riddle" | "trickster-challenge";
};

export type Orchestration = {
  root: { axis: string; pole: number; strength: number } | null;
  tension: { axis: string; strength: number } | null;
  inflection: { axis: string; pole: number }[];
  tone: Tone;
  fieldSize: number;
};

/**
 * Derive root, tension, inflection, and tone from the whole-field composition.
 * Every active system votes; nothing is cherry-picked.
 */
export function orchestrate(c: Composition): Orchestration {
  const rooted = c.axes
    .map(a => {
      let wsum = 0;
      let w = 0;
      for (const contrib of a.contributors) {
        const dw = depthWeight(contrib.system);
        wsum += contrib.value * dw;
        w += dw;
      }
      const weightedMean = w ? wsum / w : 0;
      return {
        axis: a.axis,
        pole: weightedMean,
        strength: a.coherence * Math.abs(weightedMean),
      };
    })
    .filter(x => Math.abs(x.pole) > 0.2)
    .sort((x, y) => y.strength - x.strength);
  const root = rooted[0] ?? null;

  const t = c.tensions[0];
  const tension = t ? { axis: t.axis, strength: t.strength } : null;

  const fastAxis = new Map<string, number[]>();
  for (const a of c.axes) {
    for (const contrib of a.contributors) {
      if (!isFast(contrib.system)) continue;
      if (!fastAxis.has(a.axis)) fastAxis.set(a.axis, []);
      fastAxis.get(a.axis)!.push(contrib.value);
    }
  }
  const inflection = [...fastAxis.entries()]
    .map(([axis, vals]) => ({
      axis,
      pole: vals.reduce((s, v) => s + v, 0) / vals.length,
    }))
    .filter(x => Math.abs(x.pole) > 0.3)
    .sort((x, y) => Math.abs(y.pole) - Math.abs(x.pole))
    .slice(0, 2);

  const axisMean = (name: string) => c.axes.find(a => a.axis === name)?.mean ?? 0;
  const gentleness = axisMean("gentle");
  const clarity = axisMean("light");
  const warmth = axisMean("warm");
  const charge = tension ? Math.min(1, tension.strength) : 0;

  let register: Tone["register"];
  if (charge > 0.6 && clarity < 0) register = "trickster-challenge";
  else if (clarity < -0.2) register = "quiet-riddle";
  else if (charge < 0.35 && warmth > 0.2) register = "warm-witness";
  else register = "plain-reading";

  return {
    root,
    tension,
    inflection,
    tone: { gentleness, clarity, warmth, charge, register },
    fieldSize: c.contributors.length,
  };
}

/**
 * Primary model prompt for the home phrase — structure + register from the field.
 * Optional lean hints (natal / cast) fold as weather, never as system names.
 */
export function orchestratedPrompt(
  c: Composition,
  opts?: DistillOptions,
): { system: string; user: string } {
  const o = orchestrate(c);
  const register: Tone["register"] =
    opts?.voice && opts.voice !== "field" ? opts.voice : o.tone.register;
  const chosenMouth = Boolean(opts?.voice && opts.voice !== "field");
  const toneGuide: Record<Tone["register"], string> = {
    "warm-witness":
      "The field is bright and settled. Speak as a warm witness — intimate, affirming, no need to provoke. Simply name what is.",
    "plain-reading":
      "The field is mixed. Speak plainly and evenly — a clear reading, a light turn toward the person at the end if it earns it.",
    "quiet-riddle":
      "The field is shadowed. Speak more veiled, a touch riddling — leave something unsaid for the person to turn over.",
    "trickster-challenge":
      "The field is charged and shadowed. Speak as a trickster who has dealt the user a hand and dares them to play it — provoke, turn to them, make it their move. Earn it; don't just bark.",
  };

  const system = [
    `This instant is read by ${o.fieldSize} independent traditions at once — many cultures, many timescales, all passing through one moment. You speak for the whole field, not any one voice.`,
    "Write one or two sentences naming the single character that emerges from all of them together — a logic, not a mood board.",
    "Structure: the ROOT (where the whole field agrees, weighted to slow/deep cycles) is your subject; the TENSION (its deepest split) is the turn — let the contradiction be the point, never resolve it into vague positivity; the INFLECTION (what the fast hour-cycles add) is texture on how it shows up right now.",
    "Distill ALL of the axis readings and qualities you are given. Do not cherry-pick two pretty notes and ignore the rest.",
    "End as a challenge to the reader (second person). Earn it from the chord.",
    "Name NO system, sign, planet, animal, card, number, or tradition. Name the quality, never its sources.",
    `TONE — the voice is itself a reading of this field: ${toneGuide[register]}`,
    "Never use: energy, vibes, universe, manifest, align, journey, cosmic. Write like a poet or an oracle, never a horoscope.",
    "Never name colors (red, white, blue, yellow) or kin labels — only felt weather.",
  ].join(" ");

  const rootWord = o.root ? poleWord(o.root.axis, o.root.pole) : "poised";
  const tenWords = o.tension
    ? `${poleWord(o.tension.axis, 1)} against ${poleWord(o.tension.axis, -1)}`
    : "no strong split";
  const inflWords = o.inflection.length
    ? o.inflection.map(i => poleWord(i.axis, i.pole)).join(", ")
    : "steady";

  const leanHint = opts?.colorLean
    ? [
        "",
        "Personal register (natal — MUST color the weather; never name the color itself):",
        `  Lean the sentence toward: ${COLOR_QUALITY_LEAN[opts.colorLean].slice(0, 8).join(", ")}.`,
        "  Do not name any color or kin label.",
      ]
    : [];

  const castHint =
    opts?.castLean && opts.castLean.length > 0
      ? [
          "",
          "Held cast (user embraced — MUST fold as undercurrent weather, never name the card/rune/system):",
          `  Weave in: ${opts.castLean.slice(0, 8).join(", ")}.`,
        ]
      : [];

  const axisLines = c.axes
    .filter(a => Math.abs(a.mean) > 0.2)
    .sort((a, b) => Math.abs(b.mean) * b.coherence - Math.abs(a.mean) * a.coherence)
    .map(a => {
      const dir = poleWord(a.axis, a.mean);
      const agree = a.coherence > 0.66 ? "strongly shared" : a.coherence > 0.4 ? "broadly shared" : "mixed";
      return `  ${dir} (${a.axis}): ${agree}, ${a.contributors.length} voices`;
    });

  const user = [
    `ROOT (the key, weighted toward the slow/deep cycles — your subject): ${rootWord}.`,
    `TENSION (the live edge — the turn of the sentence): ${tenWords}${o.tension ? ` (strength ${o.tension.strength.toFixed(2)})` : ""}.`,
    `INFLECTION (fast cycles, right now — texture only): ${inflWords}.`,
    `REGISTER: ${register}${chosenMouth ? " (reader chose this mouth — keep ROOT/TENSION/INFLECTION honest)" : ""}.`,
    "",
    "The whole field (axis language only, strongest first):",
    ...axisLines,
    "",
    "All qualities in play (already deduped — weather words, never sources):",
    `  ${c.activeQualities.slice(0, 48).join(", ")}`,
    ...leanHint,
    ...castHint,
    "",
    "Voice the one or two sentences this chord is signaling, in this register, naming nothing.",
  ].join("\n");

  return { system, user };
}
