/**
 * Golden natal triad checks against AA-rated / published charts.
 * Tolerances: Sun & Moon ≤ 0.3°, Ascendant ≤ 1°.
 */

import { describe, expect, it } from "vitest";
import {
  computeNatalTriad,
  toSign,
  ascendantLongitude,
  SIGNS,
} from "./natalTriad";

function lonOf(sign: string, deg: number): number {
  const i = SIGNS.indexOf(sign as (typeof SIGNS)[number]);
  if (i < 0) throw new Error(sign);
  return i * 30 + deg;
}

function assertClose(
  got: { sign: string; degreeInSign: number; longitude: number },
  expectLon: number,
  tolDeg: number,
  label: string,
) {
  const delta = Math.abs(
    ((got.longitude - expectLon + 540) % 360) - 180,
  );
  expect(delta, `${label} Δ=${delta.toFixed(3)}° (got ${got.sign} ${got.degreeInSign}°)`).toBeLessThanOrEqual(
    tolDeg,
  );
  const mapped = toSign(expectLon);
  expect(got.sign, label).toBe(mapped.sign);
}

describe("computeNatalTriad", () => {
  it("Obama AA — Sun Leo / Moon Gemini / Asc Aquarius", () => {
    // Astro.com / Astro-Databank: 1961-08-04 19:24 AHST, Honolulu
    // Sun 12°33' Leo, Moon 3°21' Gemini, Asc 18°03' Aquarius
    const triad = computeNatalTriad({
      dateLocal: "1961-08-04",
      timeLocal: "19:24",
      lat: 21.3069,
      lon: -157.8583,
      ianaTz: "Pacific/Honolulu",
    });

    expect(triad.timeIsApproximate).toBe(false);
    expect(triad.asc).not.toBeNull();
    assertClose(triad.sun, lonOf("Leo", 12 + 33 / 60), 0.3, "Sun");
    assertClose(triad.moon, lonOf("Gemini", 3 + 21 / 60), 0.3, "Moon");
    assertClose(triad.asc!, lonOf("Aquarius", 18 + 3 / 60), 1.0, "Asc");
  });

  it("Bowie — Sun Capricorn / Moon Leo / Asc Aquarius", () => {
    // Commonly cited: 1947-01-08 09:00, Brixton (Europe/London)
    const triad = computeNatalTriad({
      dateLocal: "1947-01-08",
      timeLocal: "09:00",
      lat: 51.4613,
      lon: -0.1156,
      ianaTz: "Europe/London",
    });

    expect(triad.sun.sign).toBe("Capricorn");
    expect(triad.moon.sign).toBe("Leo");
    expect(triad.asc?.sign).toBe("Aquarius");
    // Degree lock vs our own engine snapshot (ephemeris-stable)
    assertClose(triad.sun, 287.2455, 0.05, "Sun°");
    assertClose(triad.moon, 123.8318, 0.05, "Moon°");
    assertClose(triad.asc!, 303.4159, 0.2, "Asc°");
  });

  it("without birth time: Sun ok, Moon approximate, no Rising", () => {
    const triad = computeNatalTriad({
      dateLocal: "1961-08-04",
      lat: 21.3069,
      lon: -157.8583,
      ianaTz: "Pacific/Honolulu",
    });
    expect(triad.sun.sign).toBe("Leo");
    expect(triad.moon.approximate).toBe(true);
    expect(triad.asc).toBeNull();
    expect(triad.ascMessage).toMatch(/exact birth time/i);
    expect(triad.timeIsApproximate).toBe(true);
  });

  it("derives IANA zone from lat/lon when omitted", () => {
    const triad = computeNatalTriad({
      dateLocal: "1961-08-04",
      timeLocal: "19:24",
      lat: 21.3069,
      lon: -157.8583,
    });
    expect(triad.ianaTz).toMatch(/Honolulu|Hawaii/i);
    expect(triad.asc?.sign).toBe("Aquarius");
  });

  it("Ascendant atan2 convention is not 180° flipped (Obama)", () => {
    // If this ever returns Descendant (~Leo 18°), flip the formula — locked here.
    const triad = computeNatalTriad({
      dateLocal: "1961-08-04",
      timeLocal: "19:24",
      lat: 21.3069,
      lon: -157.8583,
      ianaTz: "Pacific/Honolulu",
    });
    const asc = triad.asc!.longitude;
    const desc = (asc + 180) % 360;
    const target = lonOf("Aquarius", 18.05);
    const dAsc = Math.abs(((asc - target + 540) % 360) - 180);
    const dDesc = Math.abs(((desc - target + 540) % 360) - 180);
    expect(dAsc).toBeLessThan(dDesc);
    expect(dAsc).toBeLessThanOrEqual(1);
  });
});

describe("ascendantLongitude", () => {
  it("exports a stable helper used by the triad", () => {
    // Smoke: RAMC ~0 at equator → Asc near 90°/Aries-Cancer boundary region
    const lon = ascendantLongitude(0, 0, 0, 23.439291);
    expect(lon).toBeGreaterThanOrEqual(0);
    expect(lon).toBeLessThan(360);
  });
});
