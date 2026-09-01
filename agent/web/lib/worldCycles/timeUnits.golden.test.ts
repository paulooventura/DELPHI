import { describe, it, expect } from "vitest";
import { buildCycleContext } from "./context";
import { WORLD_CYCLE_PLUGINS } from "./registry";
import { TIME_SYSTEMS, listTimeSystems } from "./timeUnits";
import { resolveSolarFrame } from "./solarDay";

const NASH = { lat: 36.16, lon: -86.78, timeZone: "America/Chicago" };
const ctxAt = (iso: string) => buildCycleContext(new Date(iso), NASH);

describe("time-unit compendium", () => {
  it("registers one plugin per system", () => {
    const timePlugins = WORLD_CYCLE_PLUGINS.filter((p) => p.category === "time-unit");
    expect(timePlugins).toHaveLength(TIME_SYSTEMS.length);
    for (const p of timePlugins) expect(p.id.startsWith("time_")).toBe(true);
  });

  it("every unit's perDay is internally consistent with meanSeconds", () => {
    for (const sys of listTimeSystems()) {
      for (const u of sys.units) {
        // perDay * meanSeconds should reconstruct one 86,400 s day (within rounding).
        expect(u.perDay * u.meanSeconds).toBeCloseTo(86400, 0);
      }
      // The ring unit must exist in the system.
      expect(sys.units.some((u) => u.id === sys.ringUnitId)).toBe(true);
    }
  });

  it("helek is 3⅓ s and 25920 per day", () => {
    const hebrew = TIME_SYSTEMS.find((s) => s.id === "hebrew_helek")!;
    const helek = hebrew.units.find((u) => u.id === "helek")!;
    expect(helek.perDay).toBe(25920);
    expect(helek.meanSeconds).toBeCloseTo(10 / 3, 6);
  });

  it("all readings resolve with finite angle and provenance meta", () => {
    const ctx = ctxAt("2026-06-21T18:00:00Z");
    for (const p of WORLD_CYCLE_PLUGINS.filter((p) => p.category === "time-unit")) {
      const r = p.resolve(ctx);
      expect(Number.isFinite(r.angleDeg)).toBe(true);
      expect(r.angleDeg).toBeGreaterThanOrEqual(0);
      expect(r.angleDeg).toBeLessThan(360);
      expect(r.meta.origin).toBeTruthy();
      expect(r.meta.purpose).toBeTruthy();
    }
  });

  it("sunrise-anchored systems are flagged seasonal; midnight ones are not", () => {
    const ctx = ctxAt("2026-06-21T18:00:00Z");
    const ghati = WORLD_CYCLE_PLUGINS.find((p) => p.id === "time_hindu_ghati")!.resolve(ctx);
    const beat = WORLD_CYCLE_PLUGINS.find((p) => p.id === "time_swatch_beat")!.resolve(ctx);
    expect(ghati.meta.anchor).toBe("sunrise");
    expect(ghati.meta.seasonal).toBe(true);
    expect(beat.meta.anchor).toBe("midnight");
    expect(beat.meta.seasonal).toBe(false);
  });

  it("the solar frame genuinely breathes between solstices", () => {
    const summer = resolveSolarFrame(new Date("2026-06-21T18:00:00Z"), NASH.lat, NASH.lon);
    const winter = resolveSolarFrame(new Date("2026-12-21T18:00:00Z"), NASH.lat, NASH.lon);
    // Nashville: ~14h35m summer daylight vs ~9h45m winter — a real, large gap.
    expect(summer.dayLengthMs).toBeGreaterThan(winter.dayLengthMs);
    const summerH = summer.dayLengthMs / 3600000;
    const winterH = winter.dayLengthMs / 3600000;
    expect(summer.polar).toBe(false);
    expect(winter.polar).toBe(false);
    // Nashville: ~14h35m summer daylight vs ~9h45m winter.
    expect(summerH).toBeGreaterThan(14);
    expect(winterH).toBeLessThan(10.5);
    expect(summerH - winterH).toBeGreaterThan(4);
  });
});

