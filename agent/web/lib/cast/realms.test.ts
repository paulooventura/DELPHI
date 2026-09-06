import { describe, expect, it } from "vitest";
import { RUNE_IDS, RUNE_STROKES, symbolForCastEntry, TRIGRAM_BY_ID } from "./realms";

describe("cast realms patterns", () => {
  it("has full Elder Futhark stroke sets", () => {
    expect(RUNE_IDS).toHaveLength(24);
    expect(RUNE_STROKES).toHaveLength(24);
  });

  it("maps Fehu and Algiz to rune strokes", () => {
    expect(symbolForCastEntry("rune-cast", "ru-fehu").kind).toBe("rune");
    expect(symbolForCastEntry("rune-cast", "ru-algiz").kind).toBe("rune");
  });

  it("maps bagua trigrams to 3-bit patterns", () => {
    expect(Object.keys(TRIGRAM_BY_ID)).toHaveLength(8);
    const qian = symbolForCastEntry("iching-trigram", "ic-qian");
    expect(qian).toEqual({ kind: "trigram", pattern: "111" });
    const kun = symbolForCastEntry("iching-trigram", "ic-kun");
    expect(kun).toEqual({ kind: "trigram", pattern: "000" });
  });

  it("keeps Orisha deities as unique emblems (not fake odu counts)", () => {
    expect(symbolForCastEntry("orisha-cast", "or-oshun")).toEqual({
      kind: "orisha-emblem",
      id: "or-oshun",
    });
  });

  it("renders tarot majors as pictorial tablets", () => {
    expect(symbolForCastEntry("tarot-major", "ta-maj-0", "0")).toEqual({
      kind: "tarot-major",
      id: "ta-maj-0",
      numeral: "0",
    });
  });

  it("renders tarot minors as suit plus rank", () => {
    expect(symbolForCastEntry("tarot-minor", "ta-wands-ace")).toEqual({
      kind: "tarot-suit",
      suit: "Wands",
      rank: "ace",
    });
  });
});
