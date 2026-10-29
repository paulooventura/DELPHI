import { describe, expect, it } from "vitest";
import { TILE_CACHE_MAX_BYTES, cacheableUrl, evictionPlan, stripProtocol } from "./tileCache";

describe("map tile cache", () => {
  it("only routes OpenFreeMap through the cache", () => {
    const tile = "https://tiles.openfreemap.org/planet/20251001/3/4/2.pbf";
    expect(cacheableUrl(tile)).toBe(`pmc://${tile}`);
    expect(stripProtocol(`pmc://${tile}`)).toBe(tile);
    expect(cacheableUrl("https://delphi.pauloventura.org/api/seafloor/3/4/2")).toBeNull();
  });

  it("drops the least recently used entries until it fits the cap", () => {
    const mb = 1024 * 1024;
    const entries = [
      { url: "new", size: 30 * mb, at: 3 },
      { url: "old", size: 30 * mb, at: 1 },
      { url: "mid", size: 30 * mb, at: 2 },
    ];
    expect(TILE_CACHE_MAX_BYTES).toBe(60 * mb);
    expect(evictionPlan(entries)).toEqual(["old"]);
    expect(evictionPlan(entries.slice(0, 2))).toEqual([]);
  });
});
