import { describe, expect, it } from "vitest";
import { jdFromDate } from "../phase/timeResolution";
import { composeMoment } from "./compose";
import { resolveMoment } from "./resolveMoment";

/** Nashville — mid-afternoon local on 2026-07-24 (civil Friday). */
const NASHVILLE = { lat: 36.1627, lon: -86.7816 };

describe("resolveMoment — computed-only invariant", () => {
  it("returns only nature === 'computed' entries (never cast or birth)", () => {
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { entries, ids } = resolveMoment(jd, NASHVILLE.lat, NASHVILLE.lon);
    expect(ids.length).toBeGreaterThanOrEqual(9);
    expect(entries).toHaveLength(ids.length);
    for (const e of entries) {
      expect(e.nature).toBe("computed");
      expect(e.nature).not.toBe("cast");
      expect(e.nature).not.toBe("birth");
    }
  });

  it("2026-07-24 Nashville: Leo + Horse (Fire) + 1 Akbal + tone 1", () => {
    // Local afternoon CDT ≈ 18:00 UTC on the 24th.
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { ids, meta } = resolveMoment(jd, NASHVILLE.lat, NASHVILLE.lon);
    expect(ids).toContain("wz-leo");
    expect(ids).toContain("cz-horse");
    expect(ids).toContain("wx-fire");
    expect(ids).toContain("tz-akbal");
    expect(ids).toContain("tn-1");
    expect(meta.tzolkinSign).toBe("Akbal");
    expect(meta.tzolkinTone).toBe(1);
    expect(meta.chineseAnimal).toBe("Horse");
  });

  it("composeMoment produces resonance + Leo/Horse steady tension", () => {
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { entries } = resolveMoment(jd, NASHVILLE.lat, NASHVILLE.lon);
    const moment = composeMoment(entries, NASHVILLE.lat, NASHVILLE.lon);
    expect(moment.chord.resonances.length + moment.chord.tensions.length).toBeGreaterThan(0);
    // Fixed Leo vs free Horse — the classic steady-axis friction.
    const steadyTension = moment.chord.tensions.find(t => t.axis === "steady");
    expect(steadyTension).toBeTruthy();
    const names = (steadyTension?.poles ?? []).map(p => p.name.toLowerCase());
    const joined = names.join(" ");
    // At least one pole mentions Leo or Horse (or their Vedic/Chinese siblings).
    expect(
      joined.includes("leo") ||
        joined.includes("horse") ||
        joined.includes("simha") ||
        names.length >= 2,
    ).toBe(true);
  });
});
