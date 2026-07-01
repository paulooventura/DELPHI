import { describe, expect, it } from "vitest";
import { altAzToEnu, buildViewBasis, dot, enuToAltAz } from "./sphericalView";

describe("buildViewBasis roll-free", () => {
  it("aligns screen-up with world up when looking at horizon", () => {
    const basis = buildViewBasis(altAzToEnu(0, 0), 0);
    expect(dot(basis.up, [0, 0, 1])).toBeGreaterThan(0.99);
  });

  it("keeps east stable when pitching vertically at fixed azimuth", () => {
    const right0 = buildViewBasis(altAzToEnu(45, 10), 0).right;
    for (const alt of [8, 5, 2, 0, -2, -5, -8]) {
      const basis = buildViewBasis(altAzToEnu(45, alt), 0);
      expect(dot(basis.right, right0)).toBeGreaterThan(0.85);
      const { az } = enuToAltAz(basis.view);
      expect(Math.abs(((az - 45 + 540) % 360) - 180)).toBeLessThan(3);
    }
  });
});
