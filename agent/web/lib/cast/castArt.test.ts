import { describe, expect, it } from "vitest";
import { castArtSrc, castArtSrcs, coinArtSrc, cowrieArtSrc } from "./castArt";

describe("cast art slots", () => {
  it("maps majors, runes, orisha, and coins", () => {
    expect(castArtSrc("tarot-major", "ta-maj-0")).toBe("/cast/tarot/major/00-the-fool.png");
    expect(castArtSrc("rune-cast", "ru-algiz")).toBe("/cast/runes/algiz.png");
    expect(castArtSrc("orisha-cast", "or-oshun")).toBe("/cast/orisha/oshun.png");
    expect(coinArtSrc(true)).toBe("/cast/iching/coin-yang.png");
    expect(cowrieArtSrc(false)).toBe("/cast/orisha/cowrie-closed.png");
  });

  it("falls back from a missing minor rank to the suit plate", () => {
    expect(castArtSrcs("tarot-minor", "ta-cups-ace")).toEqual([
      "/cast/tarot/cups/ace.png",
      "/cast/tarot/cups/suit.png",
    ]);
  });
});
