import { describe, expect, it } from "vitest";
import { altAzToEnu, buildStableViewBasis, dot, enuToAltAz } from "./sphericalView";
import { smoothViewAzAlt } from "./sensorSmoothing";

describe("buildStableViewBasis", () => {
  it("aligns screen-up with world up when looking at horizon", () => {
    const basis = buildStableViewBasis(altAzToEnu(0, 0), null);
    expect(dot(basis.up, [0, 0, 1])).toBeGreaterThan(0.99);
  });

  it("keeps east stable when pitching vertically at fixed azimuth", () => {
    let prev = buildStableViewBasis(altAzToEnu(45, 10), null);
    for (const alt of [8, 5, 2, 0, -2, -5, -8]) {
      const basis = buildStableViewBasis(altAzToEnu(45, alt), prev);
      expect(dot(basis.right, prev.right)).toBeGreaterThan(0.92);
      const { az } = enuToAltAz(basis.view);
      expect(Math.abs(((az - 45 + 540) % 360) - 180)).toBeLessThan(3);
      prev = basis;
    }
  });
});

describe("smoothViewAzAlt", () => {
  it("does not swing azimuth when only pitch changes near horizon", () => {
    const prev = altAzToEnu(90, 2);
    const target = altAzToEnu(90, -2);
    const smooth = smoothViewAzAlt(prev, target, 0.3, 0.12);
    const { az, alt } = enuToAltAz(smooth);
    expect(Math.abs(az - 90)).toBeLessThan(1.5);
    expect(alt).toBeLessThan(2);
    expect(alt).toBeGreaterThan(-2);
  });
});
