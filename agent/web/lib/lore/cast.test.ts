import { describe, expect, it, vi } from "vitest";
import { castReading, drawIndex, CAST_FRAMING } from "./cast";
import { composeMoment } from "./compose";
import { resolveMoment } from "./resolveMoment";
import { jdFromDate } from "../phase/timeResolution";
import { CAST_SYSTEMS } from "./qualia";

describe("cast integrity — crypto draw + home isolation", () => {
  it("drawIndex uses crypto.getRandomValues (never Math.random)", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    const mathSpy = vi.spyOn(Math, "random");
    const idx = drawIndex(22);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(22);
    expect(spy).toHaveBeenCalled();
    expect(mathSpy).not.toHaveBeenCalled();
    spy.mockRestore();
    mathSpy.mockRestore();
  });

  it("castReading returns honest framing and cast-nature cards", () => {
    for (const system of CAST_SYSTEMS) {
      const r = castReading(system, 1);
      expect(r.framing).toEqual(CAST_FRAMING[system]);
      expect(r.drawn.length).toBe(1);
      expect(r.drawn[0]!.nature).toBe("cast");
      if (system === "orisha-cast") {
        expect(r.framing.note).toMatch(/NOT a traditional Ifá reading/i);
        expect(r.framing.frame).toMatch(/16-cowrie/i);
      }
    }
  });

  it("no cast entry reaches the home chord", () => {
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { entries } = resolveMoment(jd, 36.16, -86.78);
    const drawn = castReading("tarot-major", 3).drawn;
    const polluted = [...entries, ...drawn];
    const moment = composeMoment(polluted, 36.16, -86.78);
    for (const c of moment.chord.contributors) {
      expect(c.nature).toBe("computed");
      expect(c.nature).not.toBe("cast");
    }
  });
});
