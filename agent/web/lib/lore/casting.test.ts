import { describe, expect, it, vi } from "vitest";
import { hexagramNumber, performCast } from "./casting";
import { castPool, tarotDeck } from "./qualia";

describe("casting addendum invariants", () => {
  it("tarotDeck returns exactly 78; a tarot cast never repeats a card", () => {
    expect(tarotDeck()).toHaveLength(78);
    const out = performCast({ realm: "tarot", depth: "celtic-cross" });
    expect(out.placements).toHaveLength(10);
    const ids = out.placements.map((p) => p.entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("King Wen lookup: all-yang→1, all-yin→2, Peace→11", () => {
    expect(hexagramNumber([true, true, true, true, true, true])).toBe(1);
    expect(hexagramNumber([false, false, false, false, false, false])).toBe(2);
    // Peace (Tai) — heaven below, earth above
    expect(hexagramNumber([true, true, true, false, false, false])).toBe(11);
  });

  it("I Ching performCast yields King Wen 1–64; changing lines transform", () => {
    // Force every line changing (old yin / old yang) by stubbing drawIndex.
    // coin() = drawIndex(2)===1; three coins sum via (coin?3:2)*3.
    // We need sums of 6 or 9 only → always same side for all three coins.
    let n = 0;
    const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation((arr) => {
      const a = arr as Uint32Array;
      // Alternate batches of three identical bits so each line is changing.
      // drawIndex(2): even → 0 (tails/2), odd → 1 (heads/3)
      // For old yang (9): three heads. For old yin (6): three tails.
      // Alternate lines: yang-changing, yin-changing, …
      const line = Math.floor(n / 3) % 2; // 0 → heads(1), 1 → tails(0)
      a[0] = line === 0 ? 1 : 0;
      n += 1;
      return arr;
    });

    const out = performCast({ realm: "iching", depth: "hexagram" });
    spy.mockRestore();

    const primary = out.placements[0]!;
    expect(primary.entry.nature).toBe("cast");
    expect(primary.entry.system).toBe("iching-hexagram");
    const num = Number(String(primary.entry.id).replace("ic-hex-", ""));
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(64);

    expect(out.transformed).toBeTruthy();
    expect(out.transformed![0]!.entry.id).not.toBe(primary.entry.id);
    const tNum = Number(String(out.transformed![0]!.entry.id).replace("ic-hex-", ""));
    expect(tNum).toBeGreaterThanOrEqual(1);
    expect(tNum).toBeLessThanOrEqual(64);
  });

  it("every performCast outcome draws only nature: cast entries", () => {
    const configs = [
      { realm: "tarot" as const, depth: "three" },
      { realm: "iching" as const, depth: "hexagram" },
      { realm: "runes" as const, depth: "draw-three" },
      { realm: "orisha" as const, depth: "cowrie" },
    ];
    for (const cfg of configs) {
      const out = performCast(cfg);
      for (const p of out.placements) {
        expect(p.entry.nature).toBe("cast");
      }
      for (const p of out.transformed ?? []) {
        expect(p.entry.nature).toBe("cast");
      }
    }
  });

  it("Orisha pool stays length 8 — no expansion toward 256 odu", () => {
    expect(castPool("orisha-cast")).toHaveLength(8);
    const out = performCast({ realm: "orisha", depth: "cowrie" });
    expect(out.placements).toHaveLength(1);
    expect(out.placements[0]!.entry.system).toBe("orisha-cast");
    expect(castPool("orisha-cast")).toHaveLength(8);
  });
});
