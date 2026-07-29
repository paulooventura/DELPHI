import { describe, expect, it } from "vitest";
import { jdFromDate } from "../phase/timeResolution";
import {
  distillTemplate,
  provenance,
  takeSnapshot,
} from "./compose";
import { resolveMoment } from "./resolveMoment";

const NASHVILLE = { lat: 36.1627, lon: -86.7816 };

describe("takeSnapshot — invariant 11", () => {
  it("two snapshots at the same instant + place are identical in chord", () => {
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const { entries } = resolveMoment(jd, NASHVILLE.lat, NASHVILLE.lon);
    const a = takeSnapshot(entries, NASHVILLE.lat, NASHVILLE.lon);
    const b = takeSnapshot(entries, NASHVILLE.lat, NASHVILLE.lon);
    expect(distillTemplate(a.chord)).toBe(distillTemplate(b.chord));
    expect(a.ordered.map(e => e.id)).toEqual(b.ordered.map(e => e.id));
    expect(a.measuredCount + a.celebratedCount).toBe(a.ordered.length);
    expect(a.chord.contributors.every(c => c.nature === "computed")).toBe(true);
    expect(a.chord.contributors.every(c => c.honesty === "render")).toBe(true);
  });

  it("snapshots hours apart differ as real cycles move (sub-day rings)", () => {
    const noon = jdFromDate(new Date("2026-07-24T17:00:00Z"));
    const evening = jdFromDate(new Date("2026-07-24T23:00:00Z"));
    const a = takeSnapshot(
      resolveMoment(noon, NASHVILLE.lat, NASHVILLE.lon).entries,
      NASHVILLE.lat,
      NASHVILLE.lon,
    );
    const b = takeSnapshot(
      resolveMoment(evening, NASHVILLE.lat, NASHVILLE.lon).entries,
      NASHVILLE.lat,
      NASHVILLE.lon,
    );
    const idsA = a.ordered.map(e => e.id).sort().join(",");
    const idsB = b.ordered.map(e => e.id).sort().join(",");
    // Planetary hour / shí / muhūrta should move across the afternoon.
    expect(idsA).not.toBe(idsB);
  });

  it("provenance names measured vs celebrated tiers", () => {
    const jd = jdFromDate(new Date("2026-07-24T18:00:00Z"));
    const snap = takeSnapshot(
      resolveMoment(jd, NASHVILLE.lat, NASHVILLE.lon).entries,
      NASHVILLE.lat,
      NASHVILLE.lon,
    );
    const prov = provenance(snap);
    expect(prov.measured.length).toBe(snap.measuredCount);
    expect(prov.celebrated.length).toBe(snap.celebratedCount);
    expect(prov.line).toMatch(/measured position/);
    expect(prov.line).toMatch(/celebrated through/);
    expect(prov.measured.every(e => e.tier === "measured")).toBe(true);
    expect(prov.celebrated.every(e => e.tier === "celebrated")).toBe(true);
  });
});
