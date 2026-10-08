import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLOCK_TUNING, SCHUMANN_HZ } from "./clockVoices";
import { NOW_CHORD } from "./heliodromeChordConfig";

const portalJs = readFileSync(join(__dirname, "..", "public", "pm-clock-bed.js"), "utf8");

describe("clock voices", () => {
  it("shares the NOW-Chord's Schumann fundamental and root", () => {
    expect(SCHUMANN_HZ).toBe(NOW_CHORD.SCHUMANN_HZ);
    expect(NOW_CHORD.ROOT_HZ).toBeCloseTo(SCHUMANN_HZ * 16, 6);
  });

  it("keeps every pitch on the integer Schumann series", () => {
    const { tick, tock, minute, hour, bellPartials } = CLOCK_TUNING;
    const multiples = [
      ...tick.body, tick.tip, tick.knock,
      ...tock.body, tock.tip, tock.knock,
      minute.fundamental, hour.fundamental,
    ];
    for (const n of multiples) expect(Number.isInteger(n)).toBe(true);
    for (const fund of [minute.fundamental, hour.fundamental]) {
      for (const p of bellPartials) expect(Number.isInteger(fund * p)).toBe(true);
    }
  });

  it("portal clock carries the same tuning table", () => {
    const m = portalJs.match(/var TUNING = (\{.*\});/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(CLOCK_TUNING);
    expect(portalJs).toContain(`var SCHUMANN_HZ = ${SCHUMANN_HZ};`);
    expect(portalJs).toContain(`var BED_HARMONICS = ${JSON.stringify(NOW_CHORD.SCHUMANN_HARMONICS).replace(/,/g, ", ")};`);
  });

  it("portal clock respects the sound-off switch", () => {
    expect(portalJs).toContain('"delphi-clock-sfx"');
    expect(portalJs).not.toContain("ctx.destination);osc");
  });
});
