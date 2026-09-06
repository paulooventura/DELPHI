import { describe, expect, it } from "vitest";
import { composePerson, natalOrreryCycles, NATAL_ORRERY_LANE_IDS } from "./resolvePerson";

const NASHVILLE = {
  year: 1990,
  month: 7,
  day: 24,
  hour: 14,
  minute: 30,
  lat: 36.16,
  lon: -86.78,
  placeLabel: "Nashville",
};

describe("natal orrery cycles on the birthday chart", () => {
  it("returns the scored orrery lanes at the saved birth instant", () => {
    const rows = natalOrreryCycles(NASHVILLE);
    expect(new Set(rows.map(r => r.id))).toEqual(new Set(NATAL_ORRERY_LANE_IDS));
    for (const row of rows) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.name.length).toBeGreaterThan(0);
    }
  });

  it("composePerson includes cycles beside the natal chord", () => {
    const person = composePerson(NASHVILLE);
    expect(person.cycles.length).toBe(NATAL_ORRERY_LANE_IDS.length);
    expect(person.galactic.kin).toBeGreaterThan(0);
    expect(person.chord.contributors.length).toBeGreaterThan(0);
  });

  it("hour-sensitive lanes move when the birth hour changes", () => {
    const noon = natalOrreryCycles({ ...NASHVILLE, hour: 12, minute: 0 });
    const night = natalOrreryCycles({ ...NASHVILLE, hour: 23, minute: 45 });
    const noonHour = noon.find(r => r.id === "planetary-hour")?.label;
    const nightHour = night.find(r => r.id === "planetary-hour")?.label;
    expect(noonHour).toBeTruthy();
    expect(nightHour).toBeTruthy();
    expect(noonHour).not.toBe(nightHour);
  });
});
