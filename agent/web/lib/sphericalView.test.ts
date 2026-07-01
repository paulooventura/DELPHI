import { describe, expect, it } from "vitest";
import { deviceBackVectorEnu, enuToAltAz } from "./sphericalView";
import { describeSkyPose, resolveMatrixAlphaDeg } from "./orientationCalibration";

describe("deviceBackVectorEnu", () => {
  it("points at the sun when upright-tilted toward ESE (compass 114°, beta 25°)", () => {
    const matrixAlpha = 360 - 114;
    const view = deviceBackVectorEnu(matrixAlpha, 25, 0);
    const { az, alt } = enuToAltAz(view);
    expect(Math.round(az)).toBe(114);
    expect(Math.round(alt)).toBe(65);
  });

  it("points below horizon when tilted toward the ground (beta 155°)", () => {
    const matrixAlpha = 360 - 114;
    const view = deviceBackVectorEnu(matrixAlpha, 155, 0);
    const { az, alt } = enuToAltAz(view);
    expect(Math.round(az)).toBe(114);
    expect(Math.round(alt)).toBe(-65);
  });
});

describe("describeSkyPose", () => {
  it("flags nearly-flat phones that aim the back at the sky", () => {
    expect(describeSkyPose(25, 0)).toBe("too-flat");
    expect(describeSkyPose(90, 0)).toBe("ready");
    expect(describeSkyPose(155, 0)).toBe("ready");
    expect(describeSkyPose(178, 0)).toBe("too-flat-down");
  });
});

describe("resolveMatrixAlphaDeg", () => {
  it("converts compass heading to matrix alpha", () => {
    const event = {
      alpha: 45,
      beta: 88,
      gamma: 0,
      webkitCompassHeading: 114,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    expect(resolveMatrixAlphaDeg(event)).toBe(246);
  });
});
