import { describe, expect, it } from "vitest";
import {
  activeCellCenterX,
  computeOrreryState,
  discreteScrollStartX,
  GHATI_MS,
  laneColor,
  laneMotion,
  laneScrollStartX,
} from "./orreryLanes";
import { computeSolarDayEvents } from "../cosmic/astronomy";

describe("orrery lanes — CLOCK-SPEC", () => {
  it("returns 12 lanes north→south with a slow-sky cluster", () => {
    const { lanes, slowSky } = computeOrreryState(
      new Date("2026-07-24T18:00:00Z"),
      36.16,
      -86.78,
    );
    expect(lanes).toHaveLength(12);
    expect(lanes[0]!.id).toBe("season"); // slow / north
    expect(lanes[lanes.length - 1]!.id).toBe("ms"); // fast / south
    expect(lanes[0]!.speedT).toBeGreaterThan(lanes[lanes.length - 1]!.speedT);
    expect(slowSky.length).toBeGreaterThanOrEqual(3);
    for (const lane of lanes) {
      expect(lane.progress).toBeGreaterThanOrEqual(0);
      expect(lane.progress).toBeLessThan(1.0001);
      expect(lane.cells.length).toBeGreaterThan(0);
    }
  });

  it("laneColor maps fast→red and slow→blue family", () => {
    const fast = laneColor(0);
    const slow = laneColor(1);
    expect(fast).toMatch(/^rgba\(220,/);
    expect(slow).toMatch(/^rgba\(50,/);
  });

  it("sub-day quality lanes resolve active labels", () => {
    const { lanes } = computeOrreryState(
      new Date("2026-07-24T18:00:00Z"),
      36.16,
      -86.78,
    );
    const muh = lanes.find(l => l.id === "muhurta")!;
    const shi = lanes.find(l => l.id === "shi")!;
    const ph = lanes.find(l => l.id === "planetary-hour")!;
    expect(muh.activeLabel.length).toBeGreaterThan(0);
    expect(shi.activeLabel.length).toBeGreaterThan(0);
    expect(ph.activeLabel.toLowerCase()).toMatch(/hour|saturn|jupiter|mars|sun|venus|mercury|moon/);
  });

  it("phase offset vs fixed now-line is the reading (not force-centered)", () => {
    const nowX = 200;
    const cellW = 80;
    // progress 0 → left edge on the line (unit just began)
    const startLeft = laneScrollStartX(nowX, 3, 0, cellW) + 3 * cellW;
    expect(startLeft).toBeCloseTo(nowX, 6);
    // progress 0.5 → cell bisected (halfway) — a reading, not a layout goal
    expect(activeCellCenterX(nowX, 0.5, cellW)).toBeCloseTo(nowX, 6);
    // progress 1 → right edge on the line (about to end)
    const endLeft = laneScrollStartX(nowX, 3, 1, cellW) + 3 * cellW;
    expect(endLeft + cellW).toBeCloseTo(nowX, 6);
    // Mid-progress must NOT snap left edge to the line
    const midLeft = laneScrollStartX(nowX, 3, 0.5, cellW) + 3 * cellW;
    expect(midLeft).toBeCloseTo(nowX - cellW / 2, 6);
  });

  it("classifies continuous glide vs discrete-tick escapement lanes", () => {
    expect(laneMotion("ms")).toBe("continuous");
    expect(laneMotion("sec")).toBe("continuous");
    expect(laneMotion("min")).toBe("continuous");
    expect(laneMotion("ghati")).toBe("continuous");
    expect(laneMotion("day")).toBe("continuous");
    expect(laneMotion("planetary-hour")).toBe("discrete-tick");
    expect(laneMotion("shi")).toBe("discrete-tick");
    expect(laneMotion("muhurta")).toBe("discrete-tick");
    expect(laneMotion("pancawara")).toBe("discrete-tick");
    expect(laneMotion("wuku-tzolkin")).toBe("discrete-tick");
    expect(laneMotion("moon")).toBe("discrete-tick");
    expect(laneMotion("season")).toBe("discrete-tick");
  });

  it("discrete hold parks left edge on the now-line until the next tick", () => {
    const nowX = 200;
    const cellW = 80;
    expect(discreteScrollStartX(nowX, 5, cellW) + 5 * cellW).toBeCloseTo(nowX, 6);
  });

  it("Nashville 5:30 PM CDT 2026-07-29 — ghati ~29 from sunrise, not ~44 from midnight", () => {
    // 5:30 PM America/Chicago = 22:30 UTC on July 29 2026
    const date = new Date("2026-07-29T22:30:00Z");
    const lat = 36.16;
    const lon = -86.78;
    const { lanes } = computeOrreryState(date, lat, lon);
    const ghati = lanes.find(l => l.id === "ghati")!;
    const sunrise = computeSolarDayEvents(date, lat, lon).sunrise;
    const expected = Math.floor((date.getTime() - sunrise.getTime()) / GHATI_MS) % 60;
    expect(ghati.index).toBe(expected);
    // Cross-check: ~11.6 h after ~5:52 AM → ~G29, never the midnight-based ~G44
    expect(ghati.index).toBeGreaterThanOrEqual(27);
    expect(ghati.index).toBeLessThanOrEqual(31);
    expect(ghati.index).not.toBe(43); // old midnight bug (0-based G44)
    expect(ghati.activeLabel).toMatch(/^Ghati 2[789]|^Ghati 3[01]/);
  });
});
