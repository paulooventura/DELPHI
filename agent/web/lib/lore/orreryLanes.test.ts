import { describe, expect, it } from "vitest";
import { computeOrreryState, laneColor } from "./orreryLanes";

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
});
