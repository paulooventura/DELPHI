import { describe, expect, it } from "vitest";
import { calculateCosmicTime } from "./timeEngine";
import { resolveWorldCycles } from "./worldCycles";
import { claimMarkStyle } from "./design/claimMarks";

const D = new Date(Date.UTC(2024, 2, 21, 12));

describe("claim taxonomy — clock rings", () => {
  const snap = calculateCosmicTime(D);
  const byId = new Map(snap.rings.map((r) => [r.ringId, r]));

  it("every ring declares a claim", () => {
    for (const r of snap.rings) expect(r.claim, r.name).toBeDefined();
  });

  it("zodiac ring is astronomical + interpretation (the acceptance case)", () => {
    const zodiac = byId.get(9)!;
    expect(zodiac.accuracy).toBe("astronomical");
    expect(zodiac.claim).toBe("interpretation");
  });

  it("claim and accuracy are independent — same accuracy, different claim", () => {
    const lunar = byId.get(6)!; // astronomical + measurement
    const zodiac = byId.get(9)!; // astronomical + interpretation
    expect(lunar.accuracy).toBe(zodiac.accuracy);
    expect(lunar.claim).not.toBe(zodiac.claim);
  });

  it("styling tracks claim, not accuracy", () => {
    const lunar = byId.get(6)!; // astronomical + measurement
    const zodiac = byId.get(9)!; // astronomical + interpretation
    // Same accuracy, different marks — because the CLAIM differs.
    expect(claimMarkStyle(lunar.claim)).not.toEqual(claimMarkStyle(zodiac.claim));

    // Different accuracy, same claim → identical marks. Accuracy must not leak into style.
    const tribe = byId.get(8)!; // arithmetical + interpretation (13:20 overlay)
    expect(zodiac.accuracy).not.toBe(tribe.accuracy);
    expect(zodiac.claim).toBe(tribe.claim);
    expect(claimMarkStyle(zodiac.claim)).toEqual(claimMarkStyle(tribe.claim));
  });
});

describe("claim taxonomy — world cycle plugins", () => {
  const world = resolveWorldCycles({ date: D, timeZone: "UTC" });

  it("every reading declares a claim", () => {
    for (const r of world.readings) expect(r.claim, r.title).toBeDefined();
  });

  it("tropical zodiac plugin is astronomical + interpretation", () => {
    const z = world.byId.tropical_zodiac!;
    expect(z.accuracy).toBe("astronomical");
    expect(z.claim).toBe("interpretation");
  });

  it("13:20 Dreamspell is interpretation, Maya tzolkin is convention — not flattened", () => {
    expect(world.byId.galactic_1320?.claim).toBe("interpretation");
    expect(world.byId.maya_tzolkin?.claim).toBe("convention");
  });
});
