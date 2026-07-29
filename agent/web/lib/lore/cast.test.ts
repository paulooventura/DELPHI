import { describe, expect, it, vi } from "vitest";
import {
  castIChingCoins,
  castOrishaDiloggun,
  castReading,
  castRuneSpread,
  castTarotSpread,
  drawIndex,
  CAST_FRAMING,
  TAROT_SPREADS,
} from "./cast";
import { composeMoment } from "./compose";
import { resolveMoment } from "./resolveMoment";
import { jdFromDate } from "../phase/timeResolution";
import { CAST_SYSTEMS, castPool, tarotDeck } from "./qualia";

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
      }
    }
  });

  it("tarot spreads draw counts without replacement and mark reverse", () => {
    for (const spread of TAROT_SPREADS) {
      const r = castTarotSpread(spread.id);
      expect(r.drawn.length).toBe(spread.count);
      expect(r.cards?.length).toBe(spread.count);
      expect(r.cards!.every(c => typeof c.reversed === "boolean")).toBe(true);
      const ids = r.drawn.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("orisha diloggun maps mouth count into the 8-principal pool", () => {
    for (let i = 0; i < 20; i++) {
      const r = castOrishaDiloggun();
      expect(r.system).toBe("orisha-cast");
      expect(r.cowrieUp).toBeGreaterThanOrEqual(0);
      expect(r.cowrieUp).toBeLessThanOrEqual(16);
      expect(r.drawn[0]!.system).toBe("orisha-cast");
      expect(r.framing.note).toMatch(/NOT a traditional Ifá reading/i);
    }
  });

  it("iching coins produce a King Wen hexagram and optional relating", () => {
    const r = castIChingCoins();
    expect(r.system).toBe("iching-hexagram");
    expect(r.ichingLines).toHaveLength(6);
    expect(r.drawn[0]!.id).toMatch(/^ic-hex-\d+$/);
    expect(r.drawn[0]!.nature).toBe("cast");
    if (r.changingLines && r.changingLines.length > 0) {
      expect(r.relating).toBeTruthy();
      expect(r.drawn.length).toBe(2);
    }
  });

  it("rune norns draws three distinct staves", () => {
    const r = castRuneSpread("norns");
    expect(r.drawn.length).toBe(3);
    expect(new Set(r.drawn.map(d => d.id)).size).toBe(3);
    expect(r.positions).toEqual(["What was", "What is", "What leans forward"]);
  });

  it("no cast entry reaches the home chord", () => {
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { entries } = resolveMoment(jd, 36.16, -86.78);
    const drawn = [
      ...castTarotSpread("three").drawn,
      ...castOrishaDiloggun().drawn,
      ...castIChingCoins().drawn,
      ...castRuneSpread("norns").drawn,
    ];
    const polluted = [...entries, ...drawn];
    const moment = composeMoment(polluted, 36.16, -86.78);
    for (const c of moment.chord.contributors) {
      expect(c.nature).toBe("computed");
      expect(c.nature).not.toBe("cast");
    }
  });

  it("Orisha pool stays length 8 — honesty boundary", () => {
    expect(castPool("orisha-cast")).toHaveLength(8);
  });

  it("tarotDeck is exactly 78", () => {
    expect(tarotDeck()).toHaveLength(78);
  });
});
