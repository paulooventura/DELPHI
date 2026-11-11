import { describe, expect, it } from "vitest";
import { SEA_LEVEL_CURVE, iceAgeLabel, seaLevelAt, seaLevelRamp } from "./seaLevel";

describe("seaLevel", () => {
  it("is today's level now and about 130 m lower at the Last Glacial Maximum", () => {
    expect(seaLevelAt(0)).toBe(0);
    expect(seaLevelAt(21)).toBe(-130);
    expect(seaLevelAt(20)).toBeCloseTo(-129, 0);
  });

  it("was higher than today in the warm Eemian and holds the oldest point beyond the curve", () => {
    expect(seaLevelAt(123)).toBeGreaterThan(0);
    expect(seaLevelAt(500)).toBe(SEA_LEVEL_CURVE[SEA_LEVEL_CURVE.length - 1]![1]);
  });

  it("keeps its points in time order", () => {
    for (let i = 1; i < SEA_LEVEL_CURVE.length; i++) expect(SEA_LEVEL_CURVE[i]![0]).toBeGreaterThan(SEA_LEVEL_CURVE[i - 1]![0]);
  });

  it("builds ramps whose stops climb, for low, high and today's seas", () => {
    for (const m of [-130, -0.6, 0, 6]) {
      const r = seaLevelRamp(m);
      const stops = r.slice(3).filter((_, i) => i % 2 === 0) as number[];
      for (let i = 1; i < stops.length; i++) expect(stops[i]!).toBeGreaterThan(stops[i - 1]!);
    }
  });

  it("names the moments people know", () => {
    expect(iceAgeLabel(0)).toBe("Today's sea level");
    expect(iceAgeLabel(21)).toContain("21,000 years ago · sea 130 m lower · Last Glacial Maximum");
    expect(iceAgeLabel(123)).toContain("higher");
  });
});
