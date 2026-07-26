import { describe, expect, it } from "vitest";
import { compose, composeMoment } from "./compose";
import {
  landCalendar,
  resolveHeritage,
} from "./geoHeritage";
import { QUALIA, byId } from "./qualia";
import { resolveMoment } from "./resolveMoment";
import { jdFromDate } from "../phase/timeResolution";

describe("geo-heritage honesty invariant", () => {
  it("foreground / acknowledge entries never enter compose()", () => {
    const forbidden = QUALIA.filter(
      q => q.honesty === "foreground" || q.honesty === "acknowledge",
    );
    expect(forbidden.length).toBeGreaterThan(0);
    // Even if a caller wrongly passes them, composeMoment strips them from the chord.
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { entries } = resolveMoment(jd, 36.16, -86.78);
    const polluted = [...entries, ...forbidden.slice(0, 3)];
    const moment = composeMoment(polluted, 36.16, -86.78);
    for (const c of moment.chord.contributors) {
      expect(c.honesty).toBe("render");
      expect(c.honesty).not.toBe("foreground");
      expect(c.honesty).not.toBe("acknowledge");
    }
    // Direct compose of only forbidden would be empty axes — still never "acknowledge" content.
    const alone = compose(forbidden.filter(q => Object.keys(q.polarities).length > 0));
    expect(alone.contributors.every(c => c.honesty !== "acknowledge")).toBe(true);
  });

  it("Nashville foregrounds Cherokee land calendar + acknowledgment", () => {
    const h = resolveHeritage(36.16, -86.78);
    expect(h.regions).toContain("cherokee");
    expect(h.acknowledgment?.people.toLowerCase()).toContain("cherokee");
    const cal = landCalendar(h.regions);
    expect(cal.length).toBeGreaterThan(0);
    expect(cal.every(q => q.honesty === "foreground")).toBe(true);
    expect(cal.every(q => q.system === "cherokee-moon")).toBe(true);
  });

  it("neutral ocean foregrounds nothing — full global chorus", () => {
    const h = resolveHeritage(0, -150); // mid-Pacific
    expect(h.regions).toEqual([]);
    expect(h.acknowledgment).toBeUndefined();
    expect(landCalendar(h.regions)).toEqual([]);
  });

  it("acknowledge traditions have no scored qualia rows", () => {
    const ack = QUALIA.filter(q => q.honesty === "acknowledge");
    expect(ack).toHaveLength(0); // by design — Australia etc. are LANDS.acknowledge only
    // Cherokee moons are foreground calendars, not acknowledge entries in QUALIA.
    expect(byId("ch-cold")?.honesty).toBe("foreground");
  });
});
