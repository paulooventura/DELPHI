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

export type DistillOptions = {
  /** Natal tribe color lean — reweights qualities already in the chorus. */
  colorLean?: TribeColor;
  /**
   * Qualities from an embraced cast (local). Soft-boosts / admits them into the
   * street phrase lean — never as chord contributors to composeMoment.
   */
  castLean?: string[];
};

/** Boost when a chorus quality overlaps an embraced cast quality. */
const CAST_LEAN_BOOST = 2.2;
/** Admit held cast qualities that the sky chorus never said — must compete. */
const CAST_LEAN_ADMIT = 2.6;
/** Soft-admit natal color register words so birth always retunes the lead. */
const COLOR_LEAN_ADMIT = 1.9;

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
 * or card — only the emergent weather.
 *
 * Optional `colorLean` / `castLean` retune the lead. When personal lean is
 * present we do NOT gate on "shared by 2+ voices" alone — that swallowed
 * birth and embraced-cast retunes.
 */
export function distillTemplate(c: Composition, opts?: DistillOptions): string {
  const castLeanList = (opts?.castLean ?? [])
    .map(q => q.trim().toLowerCase())
    .filter(Boolean);
  const castLean = new Set(castLeanList);
  const colorWords = opts?.colorLean
    ? new Set(COLOR_QUALITY_LEAN[opts.colorLean].map(w => w.toLowerCase()))
    : new Set<string>();
  const hasPersonalLean = Boolean(opts?.colorLean || castLean.size);

  const rawCounts = new Map<string, number>();
  for (const entry of c.contributors) {
    for (const q of entry.qualities) {
      const w = q.trim().toLowerCase();
      if (!w) continue;
      rawCounts.set(w, (rawCounts.get(w) ?? 0) + 1);
    }
  }

  const qualityWeights = new Map<string, number>();
  for (const entry of c.contributors) {
    for (const q of entry.qualities) {
      const w = q.trim().toLowerCase();
      if (!w) continue;
      let score = (qualityWeights.get(w) ?? 0) + 1;
      if (opts?.colorLean && colorLeanMatches(w, opts.colorLean)) {
        score += COLOR_LEAN_BOOST;
      }
      if (castLean.has(w)) score += CAST_LEAN_BOOST;
      qualityWeights.set(w, score);
    }
  }

  // Natal color register — admit so birth always shifts the lead weather.
  if (opts?.colorLean) {
    for (const w of COLOR_QUALITY_LEAN[opts.colorLean].slice(0, 6)) {
      const prev = qualityWeights.get(w) ?? 0;
      qualityWeights.set(w, prev > 0 ? prev + COLOR_LEAN_BOOST * 0.5 : COLOR_LEAN_ADMIT);
    }
  }

  // Held cast qualities — admit at competitive weight (was 0.9, lost to shared gate).
  for (const w of castLean) {
    const prev = qualityWeights.get(w) ?? 0;
    qualityWeights.set(w, prev > 0 ? prev + CAST_LEAN_BOOST : CAST_LEAN_ADMIT);
  }

  const byShare = [...qualityWeights.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const shared = byShare.filter(([w]) => (rawCounts.get(w) ?? 0) >= 2).map(([w]) => w);

  const leaning = c.axes
    .filter(a => Math.abs(a.mean) > 0.25)
    .map(a => ({ word: poleWord(a.axis, a.mean), weight: a.coherence * Math.abs(a.mean) }))
    .filter(x => x.word)
    .sort((x, y) => y.weight - x.weight);

  const lead: string[] = [];
  const push = (w: string | undefined) => {
    if (!w || lead.includes(w)) return;
    lead.push(w);
  };

  if (hasPersonalLean) {
    // One sky note, then personal register — birth/cast must be audible.
    for (const w of shared) {
      push(w);
      if (lead.length >= 1) break;
    }
    for (const w of castLeanList) {
      push(w);
      if (lead.length >= 3) break;
    }
    for (const w of colorWords) {
      push(w);
      if (lead.length >= 3) break;
    }
    for (const [w] of byShare) {
      push(w);
      if (lead.length >= 3) break;
    }
  } else {
    const fromQualities = (shared.length >= 2 ? shared : byShare.map(([w]) => w)).slice(0, 3);
    for (const w of fromQualities) push(w);
  }

  if (lead.length < 2) {
    for (const x of leaning) {
      push(x.word);
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

  const ten = c.tensions[0];
  if (ten && ten.strength > 0.4) {
    const hi = Math.max(...ten.poles.map(p => p.value));
    const lo = Math.min(...ten.poles.map(p => p.value));
    const pull = poleWord(ten.axis, hi);
    const counter = poleWord(ten.axis, lo);
    phrase += ` — ${pull} with a ${counter} current beneath`;
  }
  // Held casts always leave a visible undercurrent — even alongside sky tension.
  if (castLeanList.length > 0) {
    const held = castLeanList.slice(0, 2);
    const glue = phrase.includes(" — ") ? "; " : " — ";
    if (held.length === 2) phrase += `${glue}with ${held[0]} and ${held[1]} held beneath`;
    else phrase += `${glue}with ${held[0]} held beneath`;
  }

  return phrase.replace(/ quality,/, ",").replace(/ quality and/, " and") + ".";
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

/** The phrase for whichever layer is active. Distill with the same chorus-wide
 *  voice used everywhere (name the character, never the systems). */
export function layerPrompt(reading: LayeredReading): { system: string; user: string } {
  const layer = reading.layers.find((l) => l.id === reading.active)!;
  return buildPrompt(layer.chord);
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
