import { describe, expect, it } from "vitest";
import { wmmDeclinationDeg } from "./wmm";

// NOAA's WMM2025_TestValues.txt: year, height (km), lat, lon, declination (deg).
const NOAA: Array<[number, number, number, number, number]> = [
  [2025.0, 28, 89, -121, -99.77],
  [2025.0, 48, 80, -96, -29.91],
  [2025.0, 54, 82, 87, 54.89],
  [2025.0, 65, 43, 93, 0.5],
  [2025.0, 51, -33, 109, -5.49],
  [2025.0, 39, -59, -8, -15.75],
  [2025.0, 3, -50, -103, 27.96],
  [2025.0, 94, -29, -110, 15.74],
  [2025.0, 66, 14, 143, -0.19],
  [2025.0, 18, 0, 21, 1.29],
  [2025.5, 6, -36, -137, 20.28],
  [2025.5, 63, 26, 81, 0.51],
];

describe("WMM2025 on device", () => {
  it.each(NOAA)("matches NOAA at %s, %skm, %s°, %s°", (year, alt, lat, lon, want) => {
    expect(wmmDeclinationDeg(lat, lon, alt, year)).toBeCloseTo(want, 1);
    expect(Math.abs(wmmDeclinationDeg(lat, lon, alt, year) - want)).toBeLessThan(0.006);
  });
});
