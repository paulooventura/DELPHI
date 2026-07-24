/**
 * PHASE engine.
 *
 * computePhases(jd, loc) is a pure function. Natal charts, "now", and arbitrary
 * historical moments are the same code path — that property is what makes the
 * whole module tractable.
 */

import { couplingStrength, nearestSimpleRatio, phaseConcentration, phaseToDeg } from "./circular";
import { ASTRONOMICAL_CYCLES } from "./plugins/astronomical";
import { dateFromJd } from "./timeResolution";
import type {
  CouplingReading,
  PhaseContext,
  PhaseCycleDefinition,
  PhaseReading,
  PhaseSnapshot,
} from "./types";

const registry = new Map<string, PhaseCycleDefinition>();

export function registerCycle(def: PhaseCycleDefinition): void {
  registry.set(def.id, def);
}

export function registerCycles(defs: PhaseCycleDefinition[]): void {
  for (const d of defs) registerCycle(d);
}

export function getCycle(id: string): PhaseCycleDefinition | undefined {
  return registry.get(id);
}

export function listCycles(): PhaseCycleDefinition[] {
  return [...registry.values()];
}

// Register the built-in astronomical set.
registerCycles(ASTRONOMICAL_CYCLES);

export type ComputeOptions = {
  lat?: number;
  lon?: number;
  timeZone?: string;
  timeIsApproximate?: boolean;
  ayanamsa?: "lahiri" | "fagan_bradley";
  /** Restrict to these cycle ids. Omit for all registered. */
  only?: string[];
};

/**
 * Compute all applicable cycle phases for one instant.
 *
 * Cycles requiring location are SKIPPED when location is absent, not faked.
 * Cycles requiring exact time are skipped when the time is approximate —
 * a birth chart with unknown time should show gaps, not invented precision.
 */
export function computePhases(jd: number, opts: ComputeOptions = {}): PhaseSnapshot {
  const hasLocation = opts.lat !== undefined && opts.lon !== undefined;
  const timeIsApproximate = opts.timeIsApproximate ?? false;

  const ctx: PhaseContext = {
    instant: dateFromJd(jd),
    jd,
    timeZone: opts.timeZone ?? "UTC",
    lat: opts.lat ?? 0,
    lon: opts.lon ?? 0,
    ayanamsa: opts.ayanamsa ?? "lahiri",
    hasLocation,
    timeIsApproximate,
  };

  const defs = opts.only
    ? opts.only.map((id) => registry.get(id)).filter((d): d is PhaseCycleDefinition => !!d)
    : listCycles();

  const readings: PhaseReading[] = [];

  for (const def of defs) {
    if (def.requiresLocation && !hasLocation) continue;
    if (def.requiresExactTime && timeIsApproximate) continue;

    try {
      const { phase, meta } = def.compute(ctx);
      readings.push({
        id: def.id,
        label: def.label,
        kind: def.kind,
        domain: def.domain,
        phase,
        angleDeg: phaseToDeg(phase),
        periodDays: def.periodDays,
        accuracy: def.accuracy,
        sources: def.sources,
        derivation: def.derivation,
        meta,
      });
    } catch (err) {
      // A single bad cycle must not take down the snapshot.
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[PHASE] cycle ${def.id} failed:`, err);
      }
    }
  }

  const byId: Record<string, PhaseReading> = {};
  for (const r of readings) byId[r.id] = r;

  return {
    jd,
    instant: ctx.instant,
    lat: ctx.lat,
    lon: ctx.lon,
    timeZone: ctx.timeZone,
    timeIsApproximate,
    readings,
    byId,
  };
}

// ── Derived readings ─────────────────────────────────────────────────────────

/**
 * Near-integer resonances among tracked cycles.
 *
 * These are properties of the CYCLES, not of the person. Present as an
 * environmental reading — "these two are currently near-resonant" — never as a
 * claim about the user's psychology or destiny.
 */
export function computeCouplings(
  snapshot: PhaseSnapshot,
  minStrength = 0.6,
): CouplingReading[] {
  const osc = snapshot.readings.filter(
    (r) => r.kind === "oscillator" && Number.isFinite(r.periodDays),
  );
  const out: CouplingReading[] = [];

  for (let i = 0; i < osc.length; i++) {
    for (let j = i + 1; j < osc.length; j++) {
      const a = osc[i]!;
      const b = osc[j]!;
      const strength = couplingStrength(a.periodDays, b.periodDays);
      if (strength < minStrength) continue;
      const ratio = a.periodDays / b.periodDays;
      const nearest = nearestSimpleRatio(ratio);
      out.push({
        a: a.id,
        b: b.id,
        ratio,
        nearestRatio: nearest,
        strength,
        note: `${a.label} and ${b.label} sit near a ${nearest.p}:${nearest.q} period ratio.`,
      });
    }
  }

  return out.sort((x, y) => y.strength - x.strength);
}

/**
 * How tightly tracked cycles cluster in phase. [0,1].
 *
 * Environmental reading only. Do NOT render as a statement about the user.
 */
export function computeAlignment(
  snapshot: PhaseSnapshot,
  cycleIds?: string[],
): { concentration: number; sampleSize: number; cycleIds: string[] } {
  const pool = snapshot.readings.filter(
    (r) => r.kind === "oscillator" && (!cycleIds || cycleIds.includes(r.id)),
  );
  return {
    concentration: phaseConcentration(pool.map((r) => r.phase)),
    sampleSize: pool.length,
    cycleIds: pool.map((r) => r.id),
  };
}

// ── Natal mode ───────────────────────────────────────────────────────────────

export type CycleReturn = {
  id: string;
  label: string;
  completedCycles: number;
  currentDelta: number;      // phase distance from natal, [-0.5, 0.5]
  nextReturnJd: number;
  daysUntilReturn: number;
};

/**
 * Elapsed-cycle arithmetic between a natal moment and now.
 *
 * "You have lived through 476 lunations and your Saturn return arrives in 14
 * months" is a FACT. It needs no interpretive claim attached, and it is more
 * interesting than most of what gets sold in this category.
 */
export function computeReturns(
  natal: PhaseSnapshot,
  current: PhaseSnapshot,
): CycleReturn[] {
  const elapsedDays = current.jd - natal.jd;
  const out: CycleReturn[] = [];

  for (const now of current.readings) {
    if (now.kind !== "oscillator" || !Number.isFinite(now.periodDays)) continue;
    const born = natal.byId[now.id];
    if (!born) continue;

    const completed = Math.floor(elapsedDays / now.periodDays);

    let delta = now.phase - born.phase;
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;

    // Days until phase returns to the natal value.
    const remainingFraction = delta <= 0 ? -delta : 1 - delta;
    const daysUntil = remainingFraction * now.periodDays;

    out.push({
      id: now.id,
      label: now.label,
      completedCycles: completed,
      currentDelta: delta,
      nextReturnJd: current.jd + daysUntil,
      daysUntilReturn: daysUntil,
    });
  }

  return out.sort((a, b) => a.daysUntilReturn - b.daysUntilReturn);
}
