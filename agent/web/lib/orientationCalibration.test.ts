import { describe, expect, it, beforeEach } from "vitest";
import {
  getIosAlphaOffset,
  isUprightPortrait,
  resetOrientationCalibration,
  resolveCompassHeadingDeg,
  resolveDeviceAlphaDeg,
} from "./orientationCalibration";
import { deviceOrientationToViewEnu, dot, enuToAltAz } from "./sphericalView";

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

    // After calibration, heading is always α + offset (not live webkit).
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

  it("does not swerve azimuth when webkit drifts while pitching through the horizon", () => {
    // Calibrate once at upright.
    resolveCompassHeadingDeg({
      alpha: 40,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 100,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number });
    expect(getIosAlphaOffset()).toBe(60);

    // Pitch β through the upright/horizon band while webkit lies (drifts ~40°).
    // α is stable — heading must stay locked to α + offset, not follow webkit.
    const headings: number[] = [];
    for (const [beta, webkit] of [
      [102, 100],
      [96, 118],
      [92, 135],
      [90, 142],
      [88, 138],
      [84, 120],
      [78, 95],
    ] as const) {
      headings.push(
        resolveCompassHeadingDeg({
          alpha: 40,
          beta,
          gamma: 0,
          webkitCompassHeading: webkit,
          absolute: false,
        } as DeviceOrientationEvent & { webkitCompassHeading: number })!,
      );
    }
    // All samples within a couple degrees of the calibrated 100° lock.
    for (const h of headings) {
      const d = Math.abs(((h - 100 + 540) % 360) - 180);
      expect(d).toBeLessThan(3);
    }
  });

  it("maps compass to W3C matrix alpha (opposite sense)", () => {
    const upright = {
      alpha: 45,
      beta: 88,
      gamma: 0,
      webkitCompassHeading: 114,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(resolveDeviceAlphaDeg(upright)).toBe(246);
  });
});

describe("deviceOrientationToViewEnu", () => {
  beforeEach(() => {
    resetOrientationCalibration();
  });

  it("uses camera axis with roll zeroed (floor when beta low)", () => {
    const event = {
      alpha: 0,
      beta: 25,
      gamma: 0,
      absolute: true,
    } as DeviceOrientationEvent;

    const view = deviceOrientationToViewEnu(event);
    expect(view).not.toBeNull();
    const { alt } = enuToAltAz(view!);
    expect(alt).toBeLessThan(-50);
  });

  it("ignores roll (γ) so pitching through the horizon does not yank the sky", () => {
    const base = {
      alpha: 120,
      beta: 55,
      absolute: true,
    } as DeviceOrientationEvent;

    const view0 = deviceOrientationToViewEnu({ ...base, gamma: 0 });
    const viewR = deviceOrientationToViewEnu({ ...base, gamma: 40 });
    expect(view0).not.toBeNull();
    expect(viewR).not.toBeNull();
    // γ is zeroed in the look vector — roll must not rotate the sky.
    expect(dot(view0!, viewR!)).toBeGreaterThan(0.999);
  });
});

describe("isUprightPortrait", () => {
  it("detects upright portrait for iOS calibration", () => {
    expect(isUprightPortrait(90, 0)).toBe(true);
    expect(isUprightPortrait(28, 0)).toBe(false);
  });
});
