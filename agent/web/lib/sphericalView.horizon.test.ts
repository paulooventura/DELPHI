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
      expect(dot(basis.up, prev.up)).toBeGreaterThan(0.9);
      const { az } = enuToAltAz(basis.view);
      expect(Math.abs(((az - 45 + 540) % 360) - 180)).toBeLessThan(3);
      prev = basis;
    }
  });

  it("does not 180-flip when oscillating through the old horizon threshold", () => {
    // Former bug: hard world-up flip at view.z ≈ −0.05 fought continuity.
    let prev = buildStableViewBasis(altAzToEnu(90, 6), null);
    const alts = [4, 2, 0, -1, -3, -1, 0, 2, 4, -2, 1, -4];
    for (const alt of alts) {
      const basis = buildStableViewBasis(altAzToEnu(90, alt), prev);
      expect(dot(basis.up, prev.up)).toBeGreaterThan(0.9);
      expect(dot(basis.right, prev.right)).toBeGreaterThan(0.9);
      prev = basis;
    }
  });

  it("stays continuous when circling near zenith", () => {
    let prev = buildStableViewBasis(altAzToEnu(0, 86), null);
    for (let az = 20; az <= 360; az += 20) {
      const basis = buildStableViewBasis(altAzToEnu(az % 360, 86), prev);
      expect(dot(basis.up, prev.up)).toBeGreaterThan(0.85);
      expect(dot(basis.right, prev.right)).toBeGreaterThan(0.85);
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
