import { describe, expect, it } from "vitest";
import {
  DEVICE_CAMERA_AXIS,
  cameraAzimuthAltitude,
  deviceCameraVectorEnu,
  deviceToEnuRotationMatrix,
  horizonGammaFactor,
  mat3MulVec,
} from "./deviceAttitude";
import { enuToAltAz } from "./sphericalView";

describe("DEVICE_CAMERA_AXIS", () => {
  it("is the back/camera direction (0, 0, -1), not screen +Z or top +Y", () => {
    expect(DEVICE_CAMERA_AXIS).toEqual([0, 0, -1]);
  });
});

describe("camera pointing — W3C R · (0,0,−1)", () => {
  it("flat on table, screen up → camera aims at floor (alt ≈ −90°)", () => {
    const { az, alt } = cameraAzimuthAltitude(0, 0, 0);
    expect(alt).toBeCloseTo(-90, 0);
    expect(Number.isFinite(az)).toBe(true);
  });

  it("upright portrait, back toward true north → az ≈ 0°, alt ≈ 0°", () => {
    const { az, alt } = cameraAzimuthAltitude(0, 90, 0);
    expect(az).toBeCloseTo(0, 0);
    expect(Math.abs(alt)).toBeLessThan(1);
  });

  it("tilted so back aims at floor → altitude is negative, not near +90°", () => {
    const { alt } = cameraAzimuthAltitude(0, 25, 0);
    expect(alt).toBeLessThan(-50);
    expect(alt).toBeCloseTo(-65, 0);
  });

  it("tilted so back aims at sky (ESE ~114°, alt ~65°) with true-north α", () => {
    const matrixAlpha = 360 - 114;
    const { az, alt } = cameraAzimuthAltitude(matrixAlpha, 155, 0);
    expect(az).toBeCloseTo(114, 0);
    expect(alt).toBeCloseTo(65, 0);
  });

  it("does not use +Z screen normal (would read zenith when flat)", () => {
    const R = deviceToEnuRotationMatrix(0, 0, 0);
    const screenNormal = mat3MulVec(R, [0, 0, 1]);
    const { alt: screenAlt } = enuToAltAz(screenNormal);
    expect(screenAlt).toBeCloseTo(90, 0);

    const camera = deviceCameraVectorEnu(0, 0, 0);
    const { alt: cameraAlt } = enuToAltAz(camera);
    expect(cameraAlt).toBeCloseTo(-90, 0);
    expect(Math.sign(screenAlt)).toBe(1);
    expect(Math.sign(cameraAlt)).toBe(-1);
  });
});

describe("horizonGammaFactor", () => {
  it("zeros roll at horizontal sight line (β ≈ 90°)", () => {
    expect(horizonGammaFactor(90)).toBe(0);
    expect(horizonGammaFactor(88)).toBeLessThan(0.15);
    expect(horizonGammaFactor(68)).toBe(1);
  });

  it("zeros γ at horizontal sight line so azimuth does not spin", () => {
    const ref = cameraAzimuthAltitude(0, 90, 0);
    const withGamma = enuToAltAz(deviceCameraVectorEnu(0, 90, 8));
    expect(withGamma.az).toBeCloseTo(ref.az, 0);
    expect(withGamma.alt).toBeCloseTo(ref.alt, 0);
  });
});
