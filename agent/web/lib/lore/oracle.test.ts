import { describe, expect, it } from "vitest";
import { askOracle, DELPHIC_MAXIMS, ORACLE_MIX } from "./oracle";
import { QUALIA, type QualiaEntry } from "./qualia";

const byId = (id: string) => QUALIA.find(q => q.id === id) as QualiaEntry;
const AT = Date.parse("2026-11-12T18:30:00Z");

describe("the Pythia's answer", () => {
  const person = [byId("wz-aries"), byId("el-fire")];
  const moment = [byId("wz-leo")];

  it("is the same for the same question in the same minute (no dice)", () => {
    const a = askOracle({ person, casts: [], moment, question: "Is it better for me to move?", atMs: AT });
    const b = askOracle({ person, casts: [], moment, question: "Is it better for me to move?", atMs: AT + 20_000 });
    expect(b).toEqual(a);
  });

  it("the question's words change only the phrasing, never the verdict", () => {
    const a = askOracle({ person, casts: [], moment, question: "Should I go?", atMs: AT });
    const b = askOracle({ person, casts: [], moment, question: "Is it better for me to stay with her?", atMs: AT });
    expect([b.axis, b.pole, b.trap, b.certainty]).toEqual([a.axis, a.pole, a.trap, a.certainty]);
  });

  it("follows the strongest pull: a fiery chart and moment turn on acting or burning", () => {
    const a = askOracle({ person, casts: [], moment, question: "", atMs: AT });
    expect(["active", "warm"]).toContain(a.axis);
    expect(a.pole).toBe(1);
    expect(a.line.length).toBeGreaterThan(20);
  });

  it("mixes 0.4 / 0.3 / 0.3 and re-weights when a source is missing", () => {
    const cast = { at: new Date(AT).toISOString(), names: ["Pisces"], entries: [byId("wz-pisces")] };
    const full = askOracle({ person, casts: [cast], moment, question: "", atMs: AT });
    expect(full.sources.birth).toBeCloseTo(ORACLE_MIX.birth, 6);
    expect(full.sources.cast).toBeCloseTo(ORACLE_MIX.cast, 6);
    expect(full.sources.moment).toBeCloseTo(ORACLE_MIX.moment, 6);
    const noBirth = askOracle({ person: [], casts: [cast], moment, question: "", atMs: AT });
    expect(noBirth.sources.birth).toBe(0);
    expect(noBirth.sources.cast + noBirth.sources.moment).toBeCloseTo(1, 6);
  });

  it("newer kept casts weigh more than old ones", () => {
    const newer = { at: new Date(AT).toISOString(), names: ["Aries"], entries: [byId("wz-aries")] };
    const older = { at: new Date(AT - 28 * 86_400_000).toISOString(), names: ["Pisces"], entries: [byId("wz-pisces")] };
    const a = askOracle({ person: [], casts: [newer, older], moment: [], question: "", atMs: AT });
    const top = a.working[0]!;
    expect(top.source).toBe("cast");
    expect(top.name).toBe("Aries");
  });

  it("asks a question back when torn, otherwise closes with a Delphic maxim", () => {
    const torn = askOracle({ person: [byId("wz-aries")], casts: [], moment: [byId("wz-pisces")], question: "", atMs: AT });
    if (torn.certainty < 0.28) expect(torn.codaIsQuestion).toBe(true);
    const sure = askOracle({ person: [byId("el-fire")], casts: [], moment: [], question: "", atMs: AT });
    expect(sure.codaIsQuestion).toBe(false);
    expect(DELPHIC_MAXIMS).toContain(sure.coda);
  });

  it("shows its working: at most three inputs, shares adding to at most 1", () => {
    const a = askOracle({ person, casts: [], moment, question: "", atMs: AT });
    expect(a.working.length).toBeGreaterThan(0);
    expect(a.working.length).toBeLessThanOrEqual(3);
    expect(a.working.reduce((s, w) => s + w.share, 0)).toBeLessThanOrEqual(1.000001);
  });
});
