/**
 * PHASE — cycle phase engine.
 *
 * Extends the existing worldCycles vocabulary. Deliberately reuses AccuracyTier
 * and `sources` rather than inventing a parallel confidence scheme.
 *
 * Design contract:
 *   - Phase is a pure function of (jd, lat, lon). No wall clock, no hidden state.
 *   - Natal charts, "now", and arbitrary historical moments are the SAME code path.
 *   - Every reading carries provenance. Consumers must be able to render tier.
 */

import type { AccuracyTier, CycleContext } from "@/lib/worldCycles/types";

/** Normalized position within one full cycle, [0, 1). */
export type Phase = number;

/** Julian Day Number, UT. */
export type Julian = number;

/**
 * Whether a cycle is genuinely periodic or a linear count.
 * Long Count / era counts are NOT cyclic and must not be treated as [0,1).
 */
export type CycleKind = "oscillator" | "linear";

export type CycleDomain =
  | "terrestrial"
  | "lunar"
  | "solar"
  | "planetary"
  | "precessional"
  | "biological"
  | "conventional";

export type PhaseReading = {
  id: string;
  label: string;
  kind: CycleKind;
  domain: CycleDomain;

  /** [0,1) for oscillators. For linear cycles this is progress-within-current-unit. */
  phase: Phase;
  /** Degrees, 0–360. Convenience for ring rendering — always phase * 360. */
  angleDeg: number;
  /** Mean period in days. Infinity for linear counts. */
  periodDays: number;

  /** Reuses worldCycles AccuracyTier. Do not invent a second scheme. */
  accuracy: AccuracyTier;
  sources: string[];
  /** Human-readable: how this number was produced. Shown in provenance UI. */
  derivation: string;

  /** Present only when the cycle carries extra structure (e.g. cycle index). */
  meta?: Record<string, string | number | boolean>;
};

export type PhaseSnapshot = {
  jd: Julian;
  instant: Date;
  lat: number;
  lon: number;
  timeZone: string;
  /** True when birth time was unknown and noon was substituted. */
  timeIsApproximate: boolean;
  readings: PhaseReading[];
  byId: Record<string, PhaseReading>;
};

export type PhaseCycleDefinition = {
  id: string;
  label: string;
  kind: CycleKind;
  domain: CycleDomain;
  periodDays: number;
  accuracy: AccuracyTier;
  sources: string[];
  derivation: string;
  /** Cycles needing lat/lon are skipped (not faked) when location is absent. */
  requiresLocation: boolean;
  /** Cycles that are meaningless without a known clock time. */
  requiresExactTime: boolean;
  compute: (ctx: PhaseContext) => { phase: Phase; meta?: PhaseReading["meta"] };
};

/**
 * PHASE's context. Structurally compatible with worldCycles CycleContext so the
 * two can share a resolver, but carries the extra fields PHASE needs.
 */
export type PhaseContext = Pick<
  CycleContext,
  "instant" | "jd" | "timeZone" | "lat" | "lon" | "ayanamsa"
> & {
  hasLocation: boolean;
  timeIsApproximate: boolean;
};

/** Derived: how close two cycles sit to integer resonance. */
export type CouplingReading = {
  a: string;
  b: string;
  ratio: number;
  nearestRatio: { p: number; q: number };
  strength: number; // 0–1
  note: string;
};
