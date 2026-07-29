import { describe, expect, it } from "vitest";
import {
  activeCellCenterX,
  computeOrreryState,
  GHATI_MS,
  laneColor,
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

  it("now-line bisects the active cell at mid-progress (no half-cell left bias)", () => {
    const nowX = 200;
    const cellW = 80;
    // Mid-unit → cell centered on the line
    expect(activeCellCenterX(nowX, 0.5, cellW)).toBeCloseTo(nowX, 6);
    // Start of unit → left edge on the line
    const startX = laneScrollStartX(nowX, 3, 0, cellW);
    expect(startX + 3 * cellW).toBeCloseTo(nowX, 6);
    // End of unit → right edge on the line
    const endLeft = laneScrollStartX(nowX, 3, 1, cellW) + 3 * cellW;
    expect(endLeft + cellW).toBeCloseTo(nowX, 6);
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
