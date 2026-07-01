import { describe, expect, it, beforeEach } from "vitest";
import {
  getIosAlphaOffset,
  isUprightPortrait,
  resetOrientationCalibration,
  resolveCompassHeadingDeg,
  resolveMatrixAlphaDeg,
} from "./orientationCalibration";

describe("resolveCompassHeadingDeg", () => {
  beforeEach(() => {
    resetOrientationCalibration();
  });

  it("calibrates iOS alpha offset when upright and uses alpha when tilted", () => {
    const upright = {
      alpha: 45,
      beta: 88,
      gamma: 2,
      webkitCompassHeading: 110,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };

    expect(resolveCompassHeadingDeg(upright)).toBe(110);
    expect(getIosAlphaOffset()).toBe(65);

    const tilted = {
      alpha: 45,
      beta: 28,
      gamma: 0,
      webkitCompassHeading: 287,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };

    expect(resolveCompassHeadingDeg(tilted)).toBe(110);
  });

  it("does not use tilt-corrupted webkit before calibration", () => {
    const tilted = {
      alpha: 45,
      beta: 28,
      gamma: 0,
      webkitCompassHeading: 287,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };

    expect(resolveCompassHeadingDeg(tilted)).toBe(45);
  });

  it("detects upright portrait", () => {
    expect(isUprightPortrait(90, 0)).toBe(true);
    expect(isUprightPortrait(28, 0)).toBe(false);
  });

  it("maps compass to matrix alpha", () => {
    const upright = {
      alpha: 45,
      beta: 88,
      gamma: 0,
      webkitCompassHeading: 110,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(resolveCompassHeadingDeg(upright)).toBe(110);
    expect(resolveMatrixAlphaDeg(upright)).toBe(250);
  });
});
