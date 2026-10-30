import { describe, expect, it } from "vitest";
import { castArtSrc, castArtSrcs, coinArtSrc, cowrieArtSrc, isTarotSystem } from "./castArt";

describe("cast art slots", () => {
  it("maps majors, runes, orisha, and coins", () => {
    expect(castArtSrc("tarot-major", "ta-maj-0")).toBe("/cast/tarot/major/00-the-fool.webp");
    expect(castArtSrc("rune-cast", "ru-algiz")).toBe("/cast/runes/algiz.png");
    expect(castArtSrc("orisha-cast", "or-oshun")).toBe("/cast/orisha/oshun.png");
    expect(coinArtSrc(true)).toBe("/cast/iching/coin-yang.png");
    expect(cowrieArtSrc(false)).toBe("/cast/orisha/cowrie-closed.png");
  });

  it("tries webp, then png for majors", () => {
    expect(castArtSrcs("tarot-major", "ta-maj-XIII")).toEqual([
      "/cast/tarot/major/13-death.webp",
      "/cast/tarot/major/13-death.png",
    ]);
  });

  it("falls back from a missing minor rank to the suit plate", () => {
    expect(castArtSrcs("tarot-minor", "ta-cups-ace")).toEqual([
      "/cast/tarot/cups/ace.webp",
      "/cast/tarot/cups/ace.png",
      "/cast/tarot/cups/suit.png",
    ]);
  });

  it("flags tarot systems for full-bleed faces", () => {
    expect(isTarotSystem("tarot-minor")).toBe(true);
    expect(isTarotSystem("rune-cast")).toBe(false);
  });
});
