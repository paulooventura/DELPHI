import { describe, expect, it } from "vitest";
import { fmtSolarTime, lightAt, nightBands, nightRing, solarTimeHours, subsolarPoint, sunElevation } from "./daynight";

describe("day and night", () => {
  it("puts the subsolar point on the Tropic of Cancer near Greenwich at June solstice noon UTC", () => {
    const s = subsolarPoint(new Date("2026-06-21T12:00:00Z"));
    expect(s.lat).toBeCloseTo(23.44, 1);
    expect(Math.abs(s.lon)).toBeLessThan(1);
  });

  it("puts it near the equator at the March equinox", () => {
    const s = subsolarPoint(new Date("2026-03-20T14:46:00Z"));
    expect(Math.abs(s.lat)).toBeLessThan(0.05);
  });

  it("reads local solar time from longitude", () => {
    expect(solarTimeHours(0, 0)).toBe(12);
    expect(solarTimeHours(-90, 0)).toBe(6);
    expect(solarTimeHours(180, 0)).toBe(0);
    expect(fmtSolarTime(solarTimeHours(-75, 0))).toBe("07:00");
  });

  it("gives elevation 90 at the subsolar point and -90 opposite", () => {
    const sub = { lat: 10, lon: 40 };
    expect(sunElevation(10, 40, sub)).toBeCloseTo(90, 5);
    expect(sunElevation(-10, -140, sub)).toBeCloseTo(-90, 5);
  });

  it("closes a pole-holding night ring over the winter pole", () => {
    const sub = { lat: 23.4, lon: 0 };
    const ring = nightRing(sub, -0.833);
    expect(ring.some(p => p[1] === -90)).toBe(true);
    expect(ring.some(p => p[1] === 90)).toBe(false);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // Every boundary vertex sits on the sunset line.
    for (const [lon, lat] of ring.filter(p => Math.abs(p[1]) < 90)) expect(sunElevation(lat, lon, sub)).toBeCloseTo(-0.833, 4);
  });

  it("leaves a small astronomical cap open (no pole) near the equinox", () => {
    const ring = nightRing({ lat: 0.2, lon: 30 }, -18);
    expect(ring.every(p => Math.abs(p[1]) < 90)).toBe(true);
  });

  it("names the light from the Sun's elevation", () => {
    expect(lightAt(10)).toBe("daylight");
    expect(lightAt(-3)).toBe("civil twilight");
    expect(lightAt(-8)).toBe("nautical twilight");
    expect(lightAt(-13)).toBe("astronomical twilight");
    expect(lightAt(-30)).toBe("night");
  });

  it("builds four nested bands", () => {
    const { features } = nightBands(new Date("2026-10-29T21:00:00Z"));
    expect(features).toHaveLength(4);
    expect(features.map(f => f.properties?.id)).toEqual(["day-edge", "civil", "nautical", "astro"]);
  });
});
