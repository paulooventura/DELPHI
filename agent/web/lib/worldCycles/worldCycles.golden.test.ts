import { describe, expect, it } from "vitest";
import { gregorianToHijri } from "./calendars/hijri";
import { gregorianToHebrew, hebrewMonthDisplay } from "./calendars/hebrew";
import { gregorianToPersian } from "./calendars/persian";
import { gregorianToEthiopian } from "./calendars/ethiopian";
import { gregorianToChineseLunisolar } from "./calendars/chineseLunisolar";
import { getCycleSnapshot } from "../cycleSystems";
import { julianDay, normalizeDeg, sunEclipticLongitudeDeg } from "../cosmic/math";
import { resolveWorldCycles } from "./resolveWorldCycles";
import { synthesizeMultiVoice } from "./multiVoice";
import { atlasReadingsToClockRings } from "../timeEngine";

describe("Tier A golden dates", () => {
  it("Hebrew Rosh Hashanah 5784 = 2023-09-16", () => {
    const h = gregorianToHebrew(2023, 9, 16);
    expect(h).toEqual({ year: 5784, month: 1, day: 1 });
    expect(hebrewMonthDisplay(h.year, h.month)).toBe("Tishrei");
  });

  it("Hebrew Rosh Hashanah 5785 = 2024-10-03", () => {
    const h = gregorianToHebrew(2024, 10, 3);
    expect(h).toEqual({ year: 5785, month: 1, day: 1 });
  });

  it("Persian Nowruz 1403 ≈ 2024-03-20/21", () => {
    const a = gregorianToPersian(2024, 3, 20);
    const b = gregorianToPersian(2024, 3, 21);
    // Either day may be 1 Farvardin depending on civil midnight / algorithm edge
    const hit =
      (a.year === 1403 && a.month === 1 && a.day <= 2) ||
      (b.year === 1403 && b.month === 1 && b.day <= 2);
    expect(hit).toBe(true);
    expect(b.year).toBe(1403);
    expect(b.month).toBe(1);
  });

  it("Ethiopian Enkutatash 2017 = 2024-09-11", () => {
    expect(gregorianToEthiopian(2024, 9, 11)).toEqual({ year: 2017, month: 1, day: 1 });
  });

  it("Chinese New Year 2025-01-29 = lunar M1 D1 Snake", () => {
    const c = gregorianToChineseLunisolar(2025, 1, 29);
    expect(c.month).toBe(1);
    expect(c.day).toBe(1);
    expect(c.animal).toBe("Snake");
    expect(c.isLeapMonth).toBe(false);
  });

  it("Tabular Hijri returns stable Ramadan 1445 around 2024-03-21", () => {
    const h = gregorianToHijri(2024, 3, 21);
    expect(h.year).toBe(1445);
    expect(h.month).toBe(9); // Ramadan
    expect(h.day).toBeGreaterThanOrEqual(10);
    expect(h.day).toBeLessThanOrEqual(14);
  });
});

describe("Foundation facade", () => {
  it("tropical zodiac uses solar λ (equinox ≈ Aries)", () => {
    const d = new Date(Date.UTC(2024, 2, 20, 12));
    const lambda = normalizeDeg(sunEclipticLongitudeDeg(julianDay(d)));
    const snap = getCycleSnapshot(d);
    expect(lambda).toBeLessThan(2);
    expect(snap.westernZodiac.sign).toBe("Aries");
    const zodiac = snap.wheelLayers.find((l) => l.id === "zodiac");
    expect(zodiac?.sublabel).toMatch(/λ/);
  });

  it("resolveWorldCycles exposes Tier A ids", () => {
    const world = resolveWorldCycles({
      date: new Date(Date.UTC(2024, 2, 21, 12)),
      timeZone: "UTC",
    });
    for (const id of ["gregorian", "hijri", "hebrew", "persian", "ethiopian", "chinese_lunisolar", "tropical_zodiac"]) {
      expect(world.byId[id]).toBeTruthy();
    }
  });

  it("multi-voice synthesizes from enabled pack", () => {
    const world = resolveWorldCycles({
      date: new Date(Date.UTC(2024, 2, 21, 12)),
      timeZone: "UTC",
    });
    const voice = synthesizeMultiVoice(world, ["gregorian", "hijri", "hebrew", "persian"]);
    expect(voice).toMatch(/Hijri|Hebrew|Persian|civil/i);
  });

  it("atlas clock adapter maps readings to ring ids 11+", () => {
    const world = resolveWorldCycles({
      date: new Date(Date.UTC(2024, 2, 21, 12)),
      timeZone: "UTC",
    });
    const rings = atlasReadingsToClockRings(
      [world.byId.hijri!, world.byId.hebrew!, world.byId.persian!].filter(Boolean),
    );
    expect(rings[0]?.ringId).toBe(11);
    expect(rings.length).toBe(3);
  });
});
