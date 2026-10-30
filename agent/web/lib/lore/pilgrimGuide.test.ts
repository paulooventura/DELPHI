import { describe, expect, it } from "vitest";
import { PILGRIM_INTRO, PILGRIM_STEPS } from "./pilgrimGuide";

const BANNED = /\b(beta|predict(s|ed|ion)?|destiny|fate|you will|pay|payment|price|purchase)\b/i;

describe("pilgrim guide", () => {
  it("has the four opening films in order", () => {
    expect(PILGRIM_STEPS.map(s => s.id)).toEqual(["historical", "pythia", "stairs", "void"]);
    expect(PILGRIM_STEPS.map(s => s.step)).toEqual([1, 2, 3, 4]);
  });

  it("keeps every box readable in about ten seconds", () => {
    for (const s of PILGRIM_STEPS) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.cta.length, s.id).toBeLessThanOrEqual(20);
      expect((s.then + " " + s.now).length, s.id).toBeLessThanOrEqual(320);
    }
    expect(PILGRIM_INTRO.body.length).toBeLessThanOrEqual(160);
  });

  it("never promises prediction or asks for money", () => {
    const all = [PILGRIM_INTRO.title, PILGRIM_INTRO.body, ...PILGRIM_STEPS.flatMap(s => [s.title, s.now, s.cta])];
    for (const text of all) expect(text.replace(/not a prediction/g, "")).not.toMatch(BANNED);
    const reading = PILGRIM_STEPS.find(s => s.id === "void")!.now;
    expect(reading).toMatch(/not a prediction/);
  });
});
