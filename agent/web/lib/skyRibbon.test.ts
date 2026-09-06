import { describe, expect, it } from "vitest";
import {
  SKY_RIBBON_PERIOD,
  SKY_RIBBON_TICK_PX,
  skyRibbonTranslateX,
} from "./skyRibbon";

const BAR = 390;
const TICK = SKY_RIBBON_TICK_PX;

function tickCenter(az: number): number {
  return skyRibbonTranslateX(az, BAR) + (az / 360) * SKY_RIBBON_PERIOD * TICK + TICK / 2;
}

describe("skyRibbonTranslateX", () => {
  it("puts N (0°) under the screen center", () => {
    expect(tickCenter(0)).toBeCloseTo(BAR / 2, 5);
  });

  it("puts E (90°) under the screen center — not drifted by wrap copies", () => {
    expect(tickCenter(90)).toBeCloseTo(BAR / 2, 5);
    // Old bug: period = 21 ticks → east sat ~2.5 ticks (~56px) off center.
    const old = BAR / 2 - TICK / 2 - (90 / 360) * 21 * TICK;
    expect(Math.abs(old + 4 * TICK + TICK / 2 - BAR / 2)).toBeGreaterThan(40);
  });

  it("puts S and W under the same lubber", () => {
    expect(tickCenter(180)).toBeCloseTo(BAR / 2, 5);
    expect(tickCenter(270)).toBeCloseTo(BAR / 2, 5);
  });
});
