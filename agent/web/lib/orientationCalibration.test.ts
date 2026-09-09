import { describe, expect, it, beforeEach } from "vitest";
import {
  getCompassYawOffsetDeg,
  isUprightPortrait,
  rawLookAzAltDeg,
  resetOrientationCalibration,
  resolveCompassHeadingDeg,
  resolveDevicePitchDeg,
  setMagneticDeclinationDeg,
  setUserAzimuthOffsetDeg,
  lockLookOffsets,
  meanLookAzAlt,
} from "./orientationCalibration";
import { deviceOrientationToViewEnu, dot, enuToAltAz } from "./sphericalView";

function shortest(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

describe("resolveCompassHeadingDeg", () => {
  beforeEach(() => {
    resetOrientationCalibration();
    setMagneticDeclinationDeg(0);
    setUserAzimuthOffsetDeg(0);
  });

  it("locks the iOS yaw offset when upright, then rides the gyro while tilted", () => {
    const upright = {
      alpha: 45,
      beta: 88,
      gamma: 2,
      webkitCompassHeading: 110,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };

    // Offset lines the raw camera azimuth up with the webkit compass heading.
    expect(resolveCompassHeadingDeg(upright)).toBeCloseTo(110, 4);
    const offset = getCompassYawOffsetDeg();
    expect(offset).not.toBeNull();
    expect(shortest(rawLookAzAltDeg(upright)!.az + offset!, 110)).toBeLessThan(0.001);

    // Pitching up must not consult webkit again — heading rides the locked offset.
    const tilted = {
      alpha: 45,
      beta: 28,
      gamma: 2,
      webkitCompassHeading: 287,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    const heading = resolveCompassHeadingDeg(tilted)!;
    expect(shortest(heading, rawLookAzAltDeg(tilted)!.az + offset!)).toBeLessThan(0.001);
    // A held 2° roll really does sweep ~2° of azimuth as the phone tilts up.
    expect(shortest(heading, 110)).toBeLessThan(3);
  });

  it("does not swerve azimuth when webkit drifts while pitching through the horizon", () => {
    const calibrate = {
      alpha: 40,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 100,
      absolute: false,
    } as DeviceOrientationEvent & { webkitCompassHeading: number };
    resolveCompassHeadingDeg(calibrate);
    expect(getCompassYawOffsetDeg()).not.toBeNull();

    // Sweep down through the horizon while webkit lies wildly.
    let prev = resolveCompassHeadingDeg(calibrate)!;
    for (const [beta, webkit] of [
      [100, 180], [95, 250], [91, 20], [88, 300], [84, 140], [78, 60],
    ] as const) {
      const az = resolveCompassHeadingDeg({
        alpha: 40,
        beta,
        gamma: 0,
        webkitCompassHeading: webkit,
        absolute: false,
      } as DeviceOrientationEvent & { webkitCompassHeading: number })!;
      expect(shortest(az, prev)).toBeLessThan(1.5);
      prev = az;
    }
  });

  it("does not add screen.orientation to absolute streams (landscape double-count)", () => {
    // Absolute α is already earth-referenced; the camera ray ignores UI rotation.
    const heading = resolveCompassHeadingDeg({
      alpha: 40,
      beta: 90,
      gamma: 0,
      absolute: true,
    } as DeviceOrientationEvent);
    expect(shortest(heading!, 320)).toBeLessThan(0.001);
  });

  it("applies declination and user align as one rigid yaw", () => {
    setMagneticDeclinationDeg(-4.4);
    setUserAzimuthOffsetDeg(3);
    const event = { alpha: 40, beta: 90, gamma: 0, absolute: true } as DeviceOrientationEvent;
    const raw = rawLookAzAltDeg(event)!;
    expect(shortest(resolveCompassHeadingDeg(event)!, raw.az - 4.4 + 3)).toBeLessThan(0.001);
  });
});

describe("lockLookOffsets", () => {
  it("snaps the look so a named object sits on the reticle", () => {
    const next = lockLookOffsets({
      objectAz: 130,
      objectAlt: 25,
      viewAz: 100,
      viewAlt: 20,
      currentAzOffset: 2,
      currentAltOffset: -1,
    });
    expect(next.azOffset).toBeCloseTo(32, 5);
    expect(next.altOffset).toBeCloseTo(4, 5);
  });

  it("takes the short way around north", () => {
    const next = lockLookOffsets({
      objectAz: 10,
      objectAlt: 40,
      viewAz: 350,
      viewAlt: 40,
      currentAzOffset: 0,
      currentAltOffset: 0,
    });
    expect(next.azOffset).toBeCloseTo(20, 5);
    expect(next.altOffset).toBeCloseTo(0, 5);
  });

  it("does not pitch the whole sky when the object is far from the reticle", () => {
    const next = lockLookOffsets({
      objectAz: 200,
      objectAlt: 35,
      viewAz: 10,
      viewAlt: 5,
      currentAzOffset: 0,
      currentAltOffset: 0,
    });
    expect(next.azOffset).toBeCloseTo(-170, 5);
    expect(next.altOffset).toBe(0);
  });
});

describe("meanLookAzAlt", () => {
  it("averages a short hold, including across north", () => {
    const mean = meanLookAzAlt([
      { az: 358, alt: 40 },
      { az: 0, alt: 42 },
      { az: 2, alt: 41 },
    ]);
    expect(mean).not.toBeNull();
    expect(shortest(mean!.az, 0)).toBeLessThan(0.5);
    expect(mean!.alt).toBeCloseTo(41, 5);
  });

  it("returns null when there are no samples", () => {
    expect(meanLookAzAlt([])).toBeNull();
  });
});

describe("horizon crossing", () => {
  beforeEach(() => {
    resetOrientationCalibration();
    setMagneticDeclinationDeg(0);
    setUserAzimuthOffsetDeg(0);
  });

  it("holds azimuth while a rolled phone tilts down past the horizon", () => {
    // α + γ is the invariant a real device preserves through the gimbal lock.
    const sum = 300;
    const sweep = [
      [108, 10], [102, 12], [96, 14], [92, 16], [90, 18],
      [88, 16], [84, 14], [79, 12], [72, 10],
    ] as const;

    let prevAz: number | null = null;
    let prevAlt = Infinity;
    for (const [beta, gamma] of sweep) {
      const view = deviceOrientationToViewEnu({
        alpha: sum - gamma,
        beta,
        gamma,
        absolute: true,
      } as DeviceOrientationEvent)!;
      const { az, alt } = enuToAltAz(view);
      if (prevAz != null) expect(shortest(az, prevAz)).toBeLessThan(2);
      expect(alt).toBeLessThan(prevAlt);
      prevAz = az;
      prevAlt = alt;
    }
  });

  it("reports elevation from the camera ray, not raw beta", () => {
    const event = { alpha: 20, beta: 90, gamma: 35, absolute: true } as DeviceOrientationEvent;
    // Upright at the gimbal lock the camera is on the horizon at any roll.
    expect(Math.abs(resolveDevicePitchDeg(event)!)).toBeLessThan(0.001);
  });
});

describe("deviceOrientationToViewEnu", () => {
  beforeEach(() => {
    resetOrientationCalibration();
    setMagneticDeclinationDeg(0);
    setUserAzimuthOffsetDeg(0);
  });

  it("uses camera axis (floor when beta low)", () => {
    const view = deviceOrientationToViewEnu({
      alpha: 0,
      beta: 25,
      gamma: 0,
      absolute: true,
    } as DeviceOrientationEvent);
    expect(view).not.toBeNull();
    expect(enuToAltAz(view!).alt).toBeLessThan(-50);
  });

  it("keeps the ray fixed under a pure roll about the camera axis", () => {
    // At the horizon a pure roll is the (α + t, 90, γ − t) family.
    const a = deviceOrientationToViewEnu({
      alpha: 120, beta: 90, gamma: 0, absolute: true,
    } as DeviceOrientationEvent)!;
    const b = deviceOrientationToViewEnu({
      alpha: 90, beta: 90, gamma: 30, absolute: true,
    } as DeviceOrientationEvent)!;
    expect(dot(a, b)).toBeGreaterThan(0.9999);
  });
});

describe("isUprightPortrait", () => {
  it("detects upright portrait for iOS calibration", () => {
    expect(isUprightPortrait(90, 0)).toBe(true);
    expect(isUprightPortrait(88, 10)).toBe(true);
    expect(isUprightPortrait(30, 0)).toBe(false);
    expect(isUprightPortrait(90, 60)).toBe(false);
    expect(isUprightPortrait(null, 0)).toBe(false);
  });
});
