import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OrbitSet } from "../orbitRows";
import {
  ISS_ID_BASE,
  ISS_NORAD,
  MOON_ID_BASE,
  eveningOf,
  findVisiblePasses,
  issRecFromRow,
  planIssAlerts,
  planMoonAlerts,
  roundPlace,
} from "./skyAlerts";

const nashville = roundPlace(36.16271, -86.78159, "test");
const snapshot = JSON.parse(readFileSync(join(__dirname, "../../public/orbits/active.json"), "utf8")) as OrbitSet;
const issRow = snapshot.rows.find(r => r[0] === ISS_NORAD)!;

describe("sky alerts", () => {
  it("rounds the saved place to ~1 km", () => {
    expect(nashville).toEqual({ lat: 36.16, lon: -86.78, label: "test" });
  });

  it("puts a phase on the evening it belongs to", () => {
    const early = eveningOf(new Date(2026, 10, 5, 3, 0));
    expect([early.getDate(), early.getHours()]).toEqual([4, 19]);
    const late = eveningOf(new Date(2026, 10, 5, 22, 0));
    expect([late.getDate(), late.getHours()]).toEqual([5, 19]);
  });

  it("plans about two full and two new moons in 60 days, in order", () => {
    const from = new Date(Date.UTC(2026, 9, 29, 12));
    const plan = planMoonAlerts(from, 60, nashville);
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(plan.filter(a => a.title.startsWith("Full")).length).toBeGreaterThanOrEqual(1);
    expect(plan.filter(a => a.title.startsWith("New")).length).toBeGreaterThanOrEqual(1);
    plan.forEach((a, i) => {
      expect(a.id).toBe(MOON_ID_BASE + i);
      expect(a.at.getTime()).toBeGreaterThan(from.getTime());
      if (i) expect(a.at.getTime()).toBeGreaterThanOrEqual(plan[i - 1]!.at.getTime());
    });
  });

  it("finds sane visible ISS passes from the bundled orbit snapshot", () => {
    expect(issRow).toBeTruthy();
    const rec = issRecFromRow(issRow)!;
    const from = new Date(issRow[3] + "Z");
    // London had dawn passes that week; Nashville's window opened a few days later.
    const london = roundPlace(51.5, -0.12);
    const passes = findVisiblePasses(rec, london, from, 96);
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) {
      expect(p.maxElDeg).toBeGreaterThanOrEqual(20);
      expect(p.maxElDeg).toBeLessThanOrEqual(90);
      expect(p.rise.getTime()).toBeLessThanOrEqual(p.peak.getTime());
      expect(p.peak.getTime()).toBeLessThan(p.set.getTime());
      expect(p.set.getTime() - p.rise.getTime()).toBeLessThan(15 * 60_000);
    }
    const alerts = planIssAlerts(rec, london, from, 96);
    expect(alerts.length).toBeGreaterThan(0);
    alerts.forEach((a, i) => {
      expect(a.id).toBe(ISS_ID_BASE + i);
      expect(a.body).toMatch(/peaks \d+° high/);
    });
  });

  it("never sends the saved place anywhere", () => {
    const src = readFileSync(join(__dirname, "skyAlerts.ts"), "utf8");
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon/);
  });
});
