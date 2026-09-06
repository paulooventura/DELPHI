import { describe, expect, it } from "vitest";
import {
  DEVICE_CAMERA_AXIS,
  cameraAzimuthAltitude,
  deviceCameraVectorEnu,
  deviceToEnuRotationMatrix,
  mat3MulVec,
} from "./deviceAttitude";
import { enuToAltAz } from "./sphericalView";

function shortest(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

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

/**
 * At β = 90° the Z-X'-Y'' chain is gimbal locked: only α + γ sets the azimuth,
 * so (α, 90, γ) and (α + t, 90, γ − t) are the same physical attitude. Reading
 * yaw from α alone made those read up to 2t apart — the horizon drag.
 */
describe("horizon gimbal lock", () => {
  it("treats equal-sum (α + γ) triples at the horizon as one attitude", () => {
    const a = cameraAzimuthAltitude(40, 90, 0);
    const b = cameraAzimuthAltitude(20, 90, 20);
    const c = cameraAzimuthAltitude(0, 90, 40);
    expect(shortest(a.az, b.az)).toBeLessThan(0.001);
    expect(shortest(a.az, c.az)).toBeLessThan(0.001);
    expect(Math.abs(a.alt)).toBeLessThan(0.001);
    expect(Math.abs(c.alt)).toBeLessThan(0.001);
  });

  it("stays consistent just off the lock, where devices trade α against γ", () => {
    const straight = cameraAzimuthAltitude(40, 88, 0);
    const traded = cameraAzimuthAltitude(25, 88, 15);
    expect(shortest(straight.az, traded.az)).toBeLessThan(0.6);
    expect(Math.abs(straight.alt - traded.alt)).toBeLessThan(0.6);
  });

  it("does not jump azimuth while a rolled phone pitches through the horizon", () => {
    // Real devices hold α + γ steady through the sweep and swap between them.
    const sum = 52;
    let prev = cameraAzimuthAltitude(sum - 12, 104, 12).az;
    for (const [beta, gamma] of [
      [100, 12], [96, 14], [93, 16], [91, 18], [90, 20],
      [89, 18], [87, 16], [84, 14], [80, 12], [76, 10],
    ] as const) {
      const { az } = cameraAzimuthAltitude(sum - gamma, beta, gamma);
      expect(shortest(az, prev)).toBeLessThan(2);
      prev = az;
    }
    expect(shortest(prev, cameraAzimuthAltitude(sum - 12, 104, 12).az)).toBeLessThan(4);
  });

  it("keeps altitude monotonic across the horizon", () => {
    let prev = Infinity;
    for (const beta of [110, 105, 100, 95, 92, 90, 88, 85, 80, 75, 70]) {
      const { alt } = cameraAzimuthAltitude(40, beta, 10);
      expect(alt).toBeLessThan(prev);
      prev = alt;
    }
  });
});
