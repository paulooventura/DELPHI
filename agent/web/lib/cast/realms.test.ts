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

  it("keeps Orisha deities as cowrie emblems (not fake odu counts)", () => {
    expect(symbolForCastEntry("orisha-cast", "or-oshun")).toEqual({ kind: "cowrie-emblem" });
  });

  it("renders tarot majors as numerals", () => {
    expect(symbolForCastEntry("tarot-major", "ta-0", "0")).toEqual({
      kind: "tarot-major",
      numeral: "0",
    });
  });
});
