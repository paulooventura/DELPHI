import { describe, expect, it, vi } from "vitest";
import { phraseCacheKey, phraseForMoment } from "./distillPhrase";
import { compose } from "./compose";
import { byId } from "./qualia";

describe("distillPhrase — local speak wrapper", () => {
  it("phraseForMoment never fetches and returns a local sentence", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const chord = compose([byId("wz-leo")!, byId("el-fire")!].filter(Boolean));
    const { phrase, source } = phraseForMoment(chord, "2026-07-29", 36.16, -86.78);
    expect(source).toMatch(/local|cache/);
    expect(phrase.length).toBeGreaterThan(10);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("cache key rounds coordinates", () => {
    expect(phraseCacheKey("2026-07-24", 36.16, -86.78)).toBe(
      phraseCacheKey("2026-07-24", 36.1627, -86.7816),
    );
  });
});
