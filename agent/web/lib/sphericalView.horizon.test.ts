import { describe, expect, it } from "vitest";
import { altAzToEnu, buildViewBasis, dot, enuToAltAz } from "./sphericalView";

describe("buildViewBasis horizon stability", () => {
  it("keeps screen-up continuous when pitch crosses the horizon", () => {
    let prev = buildViewBasis(altAzToEnu(0, 8), 0, null);

    const alts = [6, 4, 2, 0.5, -0.5, -2, -4, -6];
    for (const alt of alts) {
      const view = altAzToEnu(0, alt);
      const basis = buildViewBasis(view, 0, prev);
      expect(dot(basis.up, prev.up)).toBeGreaterThan(0.85);
      prev = basis;
    }
  });

  it("does not flip east when pitching vertically at fixed azimuth", () => {
    let prev = buildViewBasis(altAzToEnu(45, 10), 0, null);
    for (const alt of [8, 5, 2, 0, -2, -5, -8]) {
      const basis = buildViewBasis(altAzToEnu(45, alt), 0, prev);
      expect(dot(basis.right, prev.right)).toBeGreaterThan(0.9);
      const { az } = enuToAltAz(basis.view);
      expect(Math.abs(((az - 45 + 540) % 360) - 180)).toBeLessThan(3);
      prev = basis;
    }
  });
});
