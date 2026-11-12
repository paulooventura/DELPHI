import { describe, expect, it } from "vitest";
import { compactAurora, compactQuakes } from "./earthFeeds";

describe("world map live layers", () => {
  it("keeps quakes with a position and a magnitude", () => {
    const d = compactQuakes({
      metadata: { generated: Date.parse("2026-11-12T18:00:00Z") },
      features: [
        { geometry: { coordinates: [-152.075, 59.035, 54.9] }, properties: { mag: 3.24, place: "36 km SSW of Nanwalek, Alaska", time: 1 } },
        { geometry: { coordinates: [10, 20] }, properties: { mag: null } },
      ],
    });
    expect(d.points).toEqual([[-152.075, 59.035, 3.2, "36 km SSW of Nanwalek, Alaska", 1]]);
    expect(d.at).toBe("2026-11-12T18:00:00.000Z");
  });

  it("keeps aurora cells with a real chance and wraps longitudes to ±180", () => {
    const d = compactAurora({ "Forecast Time": "2026-11-12T18:40:00Z", coordinates: [[0, -90, 3], [200, 65, 40], [10, 70, 5]] });
    expect(d.points).toEqual([[-160, 65, 40], [10, 70, 5]]);
    expect(d.at).toBe("2026-11-12T18:40:00Z");
  });
});
