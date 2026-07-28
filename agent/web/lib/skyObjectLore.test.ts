import { describe, expect, it } from "vitest";
import { loreForSkyObject } from "./skyObjectLore";

describe("loreForSkyObject", () => {
  it("returns classical qualities for Mars", () => {
    const lore = loreForSkyObject({ id: "mars", kind: "planet", name: "Mars" });
    expect(lore).toBeTruthy();
    expect(lore!.blurb.length).toBeGreaterThan(20);
    expect(lore!.qualities.join(" ")).toMatch(/forceful|urgent|courageous/i);
  });

  it("uses moon-phase mainframe for the Moon", () => {
    // Near full moon epoch — Illumination high; blurb should mention culmination/clarity or phase language.
    const lore = loreForSkyObject({
      id: "moon",
      kind: "planet",
      name: "Moon",
      date: new Date("2026-07-29T00:00:00Z"),
    });
    expect(lore).toBeTruthy();
    expect(lore!.qualities.length).toBeGreaterThan(0);
    expect(lore!.blurb).toMatch(/moon|light|illumin|tide|feeling|reflect|culmin|release|seed|half/i);
  });

  it("gives catalog lore for Andromeda", () => {
    const lore = loreForSkyObject({ id: "m31", kind: "deepsky", name: "Andromeda" });
    expect(lore?.blurb).toMatch(/Andromeda/i);
  });
});
