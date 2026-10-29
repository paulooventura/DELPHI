import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFLINE_MAP_FILES, offlineMapStyle } from "./offlineMapStyle";

const read = (f: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "public", "earth", "offline", `${f}.json`), "utf8"));

describe("offline world map", () => {
  const data = Object.fromEntries(OFFLINE_MAP_FILES.map(f => [f, read(f)])) as Parameters<typeof offlineMapStyle>[0];
  const style = offlineMapStyle(data);

  it("ships land, borders and cities", () => {
    expect(data.land.features.length).toBeGreaterThan(1000);
    expect(data.borders.features.length).toBeGreaterThan(300);
    expect(data.cities.features.length).toBeGreaterThan(200);
  });

  it("keeps the fill layer EarthMap paints and anchors on", () => {
    expect(style.layers.find(l => l.id === "water")?.type).toBe("fill");
  });

  it("has no text of its own, so nothing waits on glyphs offline", () => {
    expect(style.layers.some(l => l.type === "symbol")).toBe(false);
  });
});
