import { describe, expect, it } from "vitest";
import { beatIndex, keIndex, readClockLaneMarks } from "./clockLaneMarks";
import { computeSolarDayEvents } from "./cosmic/astronomy";

const NASH = { lat: 36.16, lon: -86.78 };

describe("clock lane marks", () => {
  it("tracks helek, prāṇa, and pala boundaries for the harmonic pulse stack", () => {
    const sunrise = computeSolarDayEvents(
      new Date("2026-09-01T12:00:00Z"),
      NASH.lat,
      NASH.lon,
    ).sunrise;
    const at = (ms: number) =>
      readClockLaneMarks(new Date(sunrise.getTime() + ms), NASH.lat, NASH.lon);

    expect(at(4_100).prana).not.toBe(at(100).prana);
    expect(at(24_100).pala).not.toBe(at(100).pala);

    const minute = new Date("2026-09-01T12:00:00.100Z");
    const later = new Date(minute.getTime() + 3_400);
    expect(readClockLaneMarks(later, NASH.lat, NASH.lon).helek).not.toBe(
      readClockLaneMarks(minute, NASH.lat, NASH.lon).helek,
    );
  });

  it("ghati advances ~24 min after Nashville sunrise", () => {
    const sunrise = computeSolarDayEvents(
      new Date("2026-09-01T12:00:00Z"),
      NASH.lat,
      NASH.lon,
    ).sunrise;
    const a = readClockLaneMarks(sunrise, NASH.lat, NASH.lon);
    const b = readClockLaneMarks(
      new Date(sunrise.getTime() + 24 * 60 * 1000 + 2000),
      NASH.lat,
      NASH.lon,
    );
    expect(b.ghati).toBe((a.ghati + 1) % 60);
  });

  it("kè is 100 per civil day (14.4 min)", () => {
    const midnight = new Date("2026-09-01T05:00:00Z"); // 00:00 CDT
    expect(keIndex(midnight, NASH.lat, NASH.lon)).toBe(0);
    expect(keIndex(new Date(midnight.getTime() + 15 * 60 * 1000), NASH.lat, NASH.lon)).toBe(1);
  });

  it(".beat is 1000 per BMT day (86.4 s)", () => {
    const bmtMidnight = new Date("2026-09-01T23:00:00Z"); // 00:00 UTC+1
    expect(beatIndex(bmtMidnight)).toBe(0);
    expect(beatIndex(new Date(bmtMidnight.getTime() + 87_000))).toBe(1);
  });

  it("sunrise gate fires once when the instant crosses", () => {
    const sunrise = computeSolarDayEvents(
      new Date("2026-09-01T12:00:00Z"),
      NASH.lat,
      NASH.lon,
    ).sunrise;
    const before = sunrise.getTime() - 4000;
    const after = sunrise.getTime() + 1000;
    const mark = readClockLaneMarks(new Date(after), NASH.lat, NASH.lon, before);
    expect(mark.crossedSunrise).toBe(true);
    expect(mark.crossedSunset).toBe(false);
  });
});
