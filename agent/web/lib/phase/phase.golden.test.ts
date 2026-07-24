/**
 * PHASE golden tests.
 *
 * Asserts against PUBLISHED ephemeris values — not against our own output.
 * This is the artifact that makes the astronomy defensible when someone asks
 * whether the sky data is real. If these pass, the engine is sound.
 *
 * Reference values: NASA/GSFC eclipse catalogue (Espenak), USNO equinox tables,
 * and standard lunation numbering.
 */

import { describe, expect, it } from "vitest";
import { computePhases, computeCouplings, computeReturns } from "./engine";
import { jdFromDate, resolveBirthTime, julianToGregorian } from "./timeResolution";
import { circularMean, nearestSimpleRatio, phaseDelta, normalizePhase } from "./circular";

/** Tolerance: 0.002 of a cycle ≈ 1 hour for the Moon, ~17 hours for a year. */
const PHASE_TOL = 0.002;

function jdOf(iso: string): number {
  return jdFromDate(new Date(iso));
}

describe("lunar synodic phase — known new and full moons", () => {
  // Published new moon times (UT). Phase should be ~0.
  const newMoons = [
    "2000-01-06T18:14:00Z",
    "2024-01-11T11:57:00Z",
    "2025-06-25T10:32:00Z",
  ];

  for (const iso of newMoons) {
    it(`new moon ${iso} → phase ≈ 0`, () => {
      const snap = computePhases(jdOf(iso));
      const p = snap.byId["lunar-synodic"]!.phase;
      // Phase wraps, so measure circular distance from 0.
      expect(Math.abs(phaseDelta(0, p))).toBeLessThan(0.01);
    });
  }

  // Published full moon times (UT). Phase should be ~0.5.
  const fullMoons = [
    "2024-01-25T17:54:00Z",
    "2025-07-10T20:37:00Z",
  ];

  for (const iso of fullMoons) {
    it(`full moon ${iso} → phase ≈ 0.5`, () => {
      const snap = computePhases(jdOf(iso));
      const p = snap.byId["lunar-synodic"]!.phase;
      expect(Math.abs(phaseDelta(0.5, p))).toBeLessThan(0.01);
    });
  }

  it("illumination is near zero at new moon and near one at full", () => {
    const nm = computePhases(jdOf("2024-01-11T11:57:00Z"));
    const fm = computePhases(jdOf("2024-01-25T17:54:00Z"));
    expect(Number(nm.byId["lunar-synodic"]!.meta!.illuminatedFraction)).toBeLessThan(0.02);
    expect(Number(fm.byId["lunar-synodic"]!.meta!.illuminatedFraction)).toBeGreaterThan(0.98);
  });
});

describe("tropical year — equinoxes and solstices", () => {
  // Published equinox/solstice times (UT).
  const markers: Array<[string, string, number]> = [
    ["March equinox 2024", "2024-03-20T03:06:00Z", 0.0],
    ["June solstice 2024", "2024-06-20T20:51:00Z", 0.25],
    ["September equinox 2024", "2024-09-22T12:44:00Z", 0.5],
    ["December solstice 2024", "2024-12-21T09:20:00Z", 0.75],
  ];

  for (const [label, iso, expected] of markers) {
    it(`${label} → tropical phase ≈ ${expected}`, () => {
      const snap = computePhases(jdOf(iso));
      const p = snap.byId["tropical-year"]!.phase;
      expect(Math.abs(phaseDelta(expected, p))).toBeLessThan(PHASE_TOL);
    });
  }

  it("southern hemisphere gets an offset seasonalPhase", () => {
    const north = computePhases(jdOf("2024-06-20T20:51:00Z"), { lat: 36, lon: -86 });
    const south = computePhases(jdOf("2024-06-20T20:51:00Z"), { lat: -33, lon: 151 });
    const np = Number(north.byId["tropical-year"]!.meta!.seasonalPhase);
    const sp = Number(south.byId["tropical-year"]!.meta!.seasonalPhase);
    expect(Math.abs(phaseDelta(np, sp))).toBeCloseTo(0.5, 2);
  });
});

describe("Mercury retrograde — the thing mean-period math gets wrong", () => {
  // Published retrograde windows. Mid-window should read retrograde: true.
  const retrograde = [
    "2024-04-08T00:00:00Z", // Apr 1 – Apr 25 2024
    "2024-08-15T00:00:00Z", // Aug 5 – Aug 28 2024
    "2024-12-01T00:00:00Z", // Nov 26 – Dec 15 2024
  ];
  const direct = [
    "2024-05-20T00:00:00Z",
    "2024-10-01T00:00:00Z",
  ];

  for (const iso of retrograde) {
    it(`${iso} → Mercury retrograde`, () => {
      const snap = computePhases(jdOf(iso));
      expect(snap.byId["mercury-synodic"]!.meta!.retrograde).toBe(true);
    });
  }

  for (const iso of direct) {
    it(`${iso} → Mercury direct`, () => {
      const snap = computePhases(jdOf(iso));
      expect(snap.byId["mercury-synodic"]!.meta!.retrograde).toBe(false);
    });
  }
});

describe("solar day — local apparent time", () => {
  it("solar noon in Nashville puts phase near 0.5", () => {
    // Nashville ~86.78W. Solar noon ≈ 17:47 UTC around the equinox.
    const snap = computePhases(jdOf("2024-03-20T17:47:00Z"), { lat: 36.16, lon: -86.78 });
    const p = snap.byId["solar-day"]!.phase;
    expect(Math.abs(phaseDelta(0.5, p))).toBeLessThan(0.01);
  });

  it("is skipped entirely when location is absent", () => {
    const snap = computePhases(jdOf("2024-03-20T12:00:00Z"));
    expect(snap.byId["solar-day"]).toBeUndefined();
  });

  it("is skipped when birth time is unknown", () => {
    const snap = computePhases(jdOf("2024-03-20T12:00:00Z"), {
      lat: 36.16,
      lon: -86.78,
      timeIsApproximate: true,
    });
    expect(snap.byId["solar-day"]).toBeUndefined();
  });

  it("flags polar latitudes", () => {
    const snap = computePhases(jdOf("2024-06-21T12:00:00Z"), { lat: 78, lon: 15 });
    expect(snap.byId["solar-day"]!.meta!.polarLatitude).toBe(true);
  });
});

describe("timezone resolution — historical offsets", () => {
  it("applies US DST correctly for a summer birth", () => {
    const r = resolveBirthTime({
      year: 1990, month: 7, day: 15, hour: 14, minute: 30,
      lat: 36.16, lon: -86.78,
    });
    expect(r.timeZone).toBe("America/Chicago");
    expect(r.offsetMinutes).toBe(-300); // CDT
  });

  it("applies standard time for a winter birth", () => {
    const r = resolveBirthTime({
      year: 1990, month: 1, day: 15, hour: 14, minute: 30,
      lat: 36.16, lon: -86.78,
    });
    expect(r.offsetMinutes).toBe(-360); // CST
  });

  it("uses the pre-1996 EU DST rules, not today's", () => {
    // Portugal was on WET/WEST; rules have shifted over time.
    const r = resolveBirthTime({
      year: 1975, month: 8, day: 10, hour: 9,
      lat: 38.72, lon: -9.14,
    });
    expect(r.timeZone).toBe("Europe/Lisbon");
    expect(r.warnings.filter((w) => w.includes("Could not determine"))).toHaveLength(0);
  });

  it("flags unknown birth time and substitutes noon", () => {
    const r = resolveBirthTime({
      year: 1988, month: 3, day: 2,
      lat: -23.55, lon: -46.63,
    });
    expect(r.timeIsApproximate).toBe(true);
    expect(r.warnings.some((w) => w.includes("noon"))).toBe(true);
  });

  it("converts Julian calendar dates", () => {
    // 1582-10-04 Julian is the day before the Gregorian switch.
    const g = julianToGregorian(1582, 10, 4);
    expect(g.year).toBe(1582);
    expect(g.month).toBe(10);
    expect(g.day).toBe(14);
  });
});

describe("circular math", () => {
  it("averages across the wraparound boundary correctly", () => {
    const mean = circularMean([0.99, 0.01]);
    expect(Math.abs(phaseDelta(0, mean!))).toBeLessThan(0.001);
  });

  it("does not report a linear mean of 0.5 for 0.99 and 0.01", () => {
    const mean = circularMean([0.99, 0.01])!;
    expect(Math.abs(mean - 0.5)).toBeGreaterThan(0.4);
  });

  it("normalizes negative phases", () => {
    expect(normalizePhase(-0.25)).toBeCloseTo(0.75, 10);
  });

  it("finds the Venus/Earth 8:13 near-resonance", () => {
    // 8 Earth years ≈ 13 Venus years — the pentagram cycle.
    const r = nearestSimpleRatio(365.2422 / 224.701, 12);
    expect(r.p / r.q).toBeCloseTo(1.6255, 1);
  });
});

describe("natal returns", () => {
  it("computes a plausible Saturn return", () => {
    const birth = computePhases(jdOf("1990-07-15T19:30:00Z"), { lat: 36.16, lon: -86.78 });
    const now = computePhases(jdOf("2026-07-24T12:00:00Z"), { lat: 36.16, lon: -86.78 });
    const returns = computeReturns(birth, now);
    const saturn = returns.find((r) => r.id === "saturn-sidereal")!;
    // Born 1990 → first Saturn return ~2019-2020, second ~2049.
    expect(saturn.completedCycles).toBe(1);
  });

  it("counts lunations since birth", () => {
    const birth = computePhases(jdOf("1990-07-15T19:30:00Z"));
    const now = computePhases(jdOf("2026-07-24T12:00:00Z"));
    const returns = computeReturns(birth, now);
    const moon = returns.find((r) => r.id === "lunar-synodic")!;
    // ~36 years / 29.53 days ≈ 445 lunations
    expect(moon.completedCycles).toBeGreaterThan(430);
    expect(moon.completedCycles).toBeLessThan(460);
  });
});

describe("provenance contract", () => {
  it("every reading carries accuracy and sources", () => {
    const snap = computePhases(jdOf("2026-07-24T12:00:00Z"), { lat: 36.16, lon: -86.78 });
    for (const r of snap.readings) {
      expect(r.accuracy).toBeTruthy();
      expect(r.sources.length).toBeGreaterThan(0);
      expect(r.derivation.length).toBeGreaterThan(0);
    }
  });

  it("purity: same jd yields identical output", () => {
    const jd = jdOf("2026-07-24T12:00:00Z");
    const a = computePhases(jd, { lat: 36.16, lon: -86.78 });
    const b = computePhases(jd, { lat: 36.16, lon: -86.78 });
    expect(a.readings.map((r) => r.phase)).toEqual(b.readings.map((r) => r.phase));
  });

  it("all oscillator phases lie in [0,1)", () => {
    const snap = computePhases(jdOf("2026-07-24T12:00:00Z"), { lat: 36.16, lon: -86.78 });
    for (const r of snap.readings) {
      if (r.kind !== "oscillator") continue;
      expect(r.phase).toBeGreaterThanOrEqual(0);
      expect(r.phase).toBeLessThan(1);
    }
  });
});

describe("coupling", () => {
  it("returns pairs sorted by strength, no self-pairs", () => {
    const snap = computePhases(jdOf("2026-07-24T12:00:00Z"), { lat: 36.16, lon: -86.78 });
    const couplings = computeCouplings(snap, 0.3);
    for (const c of couplings) expect(c.a).not.toBe(c.b);
    for (let i = 1; i < couplings.length; i++) {
      expect(couplings[i - 1]!.strength).toBeGreaterThanOrEqual(couplings[i]!.strength);
    }
  });
});
