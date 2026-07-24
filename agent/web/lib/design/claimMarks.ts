import type { AccuracyTier, ClaimKind } from "../worldCycles/types";

/**
 * How a ring is *marked* — driven ONLY by what kind of claim it makes, never by how
 * precise its number is (AccuracyTier). This is the whole point of the (b) split:
 * a Tzolkin ring must not look like a degraded lunar ring; it's a different category,
 * not a worse measurement.
 *
 * The three registers are different KINDS of mark, not three points on one strong→weak
 * gradient. Opacity is full for all three — dimming interpretation would say "less real",
 * which is the wrong claim. It's a different claim, made with the same confidence.
 *
 *  - measurement  → graduated ticks. The ring is an instrument scale; intermediate
 *                   positions are meaningful.
 *  - convention   → discrete dividers. Divided, not graduated: there is no meaningful
 *                   position "between" kin 47 and 48.
 *  - interpretation → detached band: inset with a visible gap, dashed boundary, no
 *                   ticks — there is nothing to graduate. It sits on its own plane.
 */
export type ClaimMarkStyle = {
  /** Graduated instrument ticks (measurement only). */
  hasTicks: boolean;
  /** Discrete per-unit divider lines (convention only). */
  hasDividers: boolean;
  /** Bounding-stroke dash pattern. "" = solid; non-empty = detached/authored. */
  boundaryDash: string;
  /** Radial inset in px. >0 pulls the ring into its own band with a visible gap. */
  inset: number;
  /**
   * Bounding-stroke colour. measurement/convention share the instrument gold; interpretation
   * shifts to violet so it reads as a different *plane*, not a fainter instrument. A hue
   * shift is a "different kind" signal that survives small scale where a fine dash aliases
   * to a solid line — which is exactly what the mobile legibility check exposed.
   */
  boundaryColor: string;
  /**
   * Mark opacity — deliberately identical across all three. If these ever diverge,
   * the styling has quietly rebuilt the confidence ranking the taxonomy removed.
   */
  markOpacity: number;
};

// Gold = the instrument. Violet = authored overlay. Kept as named constants so the
// "interpretation is a different plane" intent survives a careless edit.
const INSTRUMENT_GOLD = "#c9a227";
const AUTHORED_VIOLET = "#c4b5fd";

export const CLAIM_MARKS: Record<ClaimKind, ClaimMarkStyle> = {
  measurement: {
    hasTicks: true,
    hasDividers: false,
    boundaryDash: "",
    inset: 0,
    boundaryColor: INSTRUMENT_GOLD,
    markOpacity: 1,
  },
  convention: {
    hasTicks: false,
    hasDividers: true,
    boundaryDash: "",
    inset: 0,
    boundaryColor: INSTRUMENT_GOLD,
    markOpacity: 1,
  },
  // Detached plane: wide inset (unmistakable gap), coarse dash (survives aliasing at
  // ~390px), violet boundary. Three independent signals so measurement / convention /
  // interpretation never collapse to two at small scale.
  interpretation: {
    hasTicks: false,
    hasDividers: false,
    boundaryDash: "6 5",
    inset: 7,
    boundaryColor: AUTHORED_VIOLET,
    markOpacity: 1,
  },
};

/** Human-readable register label — a rendering of the claim, not a parallel vocabulary. */
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  measurement: "Measured",
  convention: "Convention",
  interpretation: "Interpretation",
};

/** Resolve a ring/layer's mark style, defaulting unlabeled rings to convention. */
export function claimMarkStyle(claim: ClaimKind | undefined): ClaimMarkStyle {
  return CLAIM_MARKS[claim ?? "convention"];
}

const ACCURACY_PHRASE: Record<AccuracyTier, string> = {
  astronomical: "ephemeris precision",
  civil: "exact by definition",
  arithmetical: "exact by rule",
  "mean-orbit": "approximate periodicity",
};

/**
 * Provenance as prose, not a badge: what KIND of claim, how precise, and the source.
 * A sentence does more work than a chip and is the surface Task 9's disagreement
 * feature will eventually grow from.
 */
export function claimSentence(
  claim: ClaimKind | undefined,
  accuracy?: AccuracyTier,
  sources?: string[],
): string {
  const lead =
    claim === "measurement"
      ? "Measured position"
      : claim === "interpretation"
        ? "An authored interpretation"
        : "An agreed convention";
  const precision = accuracy ? ` (${ACCURACY_PHRASE[accuracy]})` : "";
  const src = sources && sources.length > 0 ? ` — ${sources.join("; ")}` : "";
  return `${lead}${precision}${src}`;
}
