import { describe, expect, it } from "vitest";
import { acceptPhrase, fallbackPhrase, phraseCacheKey } from "./distillPhrase";
import type { Composition } from "./compose";

const stubChord = {
  axes: [],
  resonances: [{ axis: "warm", strength: 0.8, pole: 0.7, entries: ["Leo", "Fire"] }],
  tensions: [
    {
      axis: "steady",
      strength: 0.7,
      poles: [
        { name: "Leo", value: 0.8, system: "western-zodiac" },
        { name: "Horse", value: -0.6, system: "chinese-animal" },
      ],
    },
  ],
  activeQualities: ["radiant", "restless", "warm"],
  contributors: [],
} as unknown as Composition;

describe("distillPhrase gates", () => {
  it("accepts a single grounded sentence", () => {
    expect(acceptPhrase("A radiant restlessness holds the day.")).toBe(
      "A radiant restlessness holds the day.",
    );
  });

  it("rejects banned lexicon and multi-sentence output", () => {
    expect(acceptPhrase("The energy of the day is bright.")).toBeNull();
    expect(acceptPhrase("One. Two.")).toBeNull();
    expect(acceptPhrase("Align with the universe.")).toBeNull();
    expect(acceptPhrase("A cosmic Leo brightness.")).toBeNull();
  });

  it("fallback never blocks and names the chord without tradition labels", () => {
    const p = fallbackPhrase(stubChord);
    expect(p.endsWith(".")).toBe(true);
    expect(p.length).toBeGreaterThan(10);
    expect(p).not.toMatch(/leo|horse/i);
    expect(acceptPhrase(p) || p).toBeTruthy();
  });

  it("cache key rounds coordinates", () => {
    expect(phraseCacheKey("2026-07-24", 36.16, -86.78)).toBe(
      phraseCacheKey("2026-07-24", 36.1627, -86.7816),
    );
  });
});
