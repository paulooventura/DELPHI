import { describe, expect, it, beforeEach } from "vitest";
import {
  getIosAlphaOffset,
  isUprightPortrait,
  resetOrientationCalibration,
  resolveCompassHeadingDeg,
  resolveDeviceAlphaDeg,
  resolveDevicePitchDeg,
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

  it("uses decoupled pitch from beta only (floor when beta low)", () => {
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
    expect(resolveDevicePitchDeg(event)).toBe(-65);
  });

  it("ignores roll (gamma) when alpha and beta are fixed", () => {
    const base = {
      alpha: 120,
      beta: 90,
      absolute: true,
    } as DeviceOrientationEvent;

    const view0 = deviceOrientationToViewEnu({ ...base, gamma: 0 });
    for (const gamma of [-75, -45, 0, 45, 75]) {
      const view = deviceOrientationToViewEnu({ ...base, gamma });
      expect(view).not.toBeNull();
      expect(dot(view!, view0!)).toBeGreaterThan(0.9999);
    }
  });
});

describe("isUprightPortrait", () => {
  it("detects upright portrait for iOS calibration", () => {
    expect(isUprightPortrait(90, 0)).toBe(true);
    expect(isUprightPortrait(28, 0)).toBe(false);
  });
});
