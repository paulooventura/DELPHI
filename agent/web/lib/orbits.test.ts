import { readFileSync } from "node:fs";
import { join } from "node:path";
import { json2satrec, propagate } from "satellite.js";
import { describe, expect, it } from "vitest";
import {
  compactOmm,
  earthLogRadius,
  earthRotationDeg,
  extrapolate,
  launchYear,
  measureSat,
  orbitShape,
  pointClass,
  rowToOmm,
  temeToGeodetic,
  type GpRow,
  type OrbitSet,
} from "./orbits";

const active = JSON.parse(readFileSync(join(__dirname, "..", "public", "orbits", "active.json"), "utf8")) as OrbitSet;
const epochOf = (r: GpRow) => new Date(`${r[3]}Z`);

function stateAt(r: GpRow, date: Date) {
  const pv = propagate(json2satrec(rowToOmm(r) as never), date);
  if (!pv || typeof pv.position === "boolean") throw new Error(`no state for ${r[1]}`);
  return { p: pv.position, v: pv.velocity as { x: number; y: number; z: number } };
}

describe("orbit snapshot", () => {
  it("has the active catalog with named stations", () => {
    expect(active.rows.length).toBeGreaterThan(8000);
    const ids = new Set(active.rows.map((r) => r[0]));
    expect(ids.has(25544)).toBe(true);
    expect(ids.has(48274)).toBe(true);
    expect(ids.has(20580)).toBe(true);
  });

  it("compacts OMM rows and reads launch years", () => {
    const [row] = compactOmm([
      { OBJECT_NAME: "ISS (ZARYA)", OBJECT_ID: "1998-067A", EPOCH: "2026-10-28T12:00:00.000000", MEAN_MOTION: 15.5, ECCENTRICITY: 0.0004, INCLINATION: 51.64, RA_OF_ASC_NODE: 10, ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30, NORAD_CAT_ID: 25544, BSTAR: 0.0002, MEAN_MOTION_DOT: 0.0001, MEAN_MOTION_DDOT: 0 },
    ]);
    expect(row![0]).toBe(25544);
    expect(launchYear(row![2])).toBe(1998);
  });
});

describe("SGP4 through the compact rows", () => {
  it("puts the ISS at 400–430 km with a ~92 minute period", () => {
    const iss = active.rows.find((r) => r[0] === 25544)!;
    const t = new Date(epochOf(iss).getTime() + 3_600_000);
    const { p, v } = stateAt(iss, t);
    const mean = orbitShape(iss[4], iss[5], iss[6]).aKm - 6371;
    expect(mean).toBeGreaterThan(400);
    expect(mean).toBeLessThan(430);
    const alt = temeToGeodetic(p, t).altKm;
    expect(alt).toBeGreaterThan(395);
    expect(alt).toBeLessThan(440);
    const m = measureSat(iss, p, v, t);
    expect(m.periodMin).toBeGreaterThan(91);
    expect(m.periodMin).toBeLessThan(94);
    expect(m.speedKmS).toBeGreaterThan(7.5);
    expect(m.speedKmS).toBeLessThan(7.8);
    expect(m.cls).toBe("LEO");
    expect(m.moonKm).toBeGreaterThan(350_000);
    expect(pointClass(iss, "satellites")).toBe(6);
  });

  it("puts a GPS satellite near 20,200 km in MEO", () => {
    const gps = active.rows.find((r) => /^NAVSTAR/.test(r[1]) && r[5] < 0.005 && Math.abs(r[4] - 2.0056) < 0.001)!;
    expect(gps).toBeTruthy();
    expect(Math.abs(orbitShape(gps[4], gps[5], gps[6]).aKm - 6371 - 20_200)).toBeLessThan(100);
    const t = epochOf(gps);
    const { p } = stateAt(gps, t);
    const alt = temeToGeodetic(p, t).altKm;
    expect(Math.abs(alt - 20_200)).toBeLessThan(150);
    expect(orbitShape(gps[4], gps[5], gps[6]).cls).toBe("MEO");
  });

  it("puts a geostationary satellite near 35,786 km at ~0° inclination", () => {
    const geo = active.rows.find((r) => /^(GOES|INTELSAT|SES)/.test(r[1]) && r[6] < 0.1 && r[5] < 0.001 && Math.abs(1440 / r[4] - 1436.1) < 1)!;
    expect(geo).toBeTruthy();
    const t = epochOf(geo);
    const { p } = stateAt(geo, t);
    const alt = temeToGeodetic(p, t).altKm;
    expect(Math.abs(alt - 35_786)).toBeLessThan(60);
    const shape = orbitShape(geo[4], geo[5], geo[6]);
    expect(shape.cls).toBe("GEO");
    expect(geo[6]).toBeLessThan(0.1);
  });

  it("extrapolates a LEO state over a few seconds within a few hundred metres", () => {
    const iss = active.rows.find((r) => r[0] === 25544)!;
    const t0 = epochOf(iss);
    const a = stateAt(iss, t0);
    const b = stateAt(iss, new Date(t0.getTime() + 5000));
    const e = extrapolate(a.p, a.v, 5);
    expect(Math.hypot(e.x - b.p.x, e.y - b.p.y, e.z - b.p.z)).toBeLessThan(0.3);
  });
});

describe("Earth rotation and scale", () => {
  it("advances ~360.9856° per solar day", () => {
    const t0 = new Date("2026-10-29T00:00:00Z");
    const t1 = new Date(t0.getTime() + 86_400_000);
    const d = (((earthRotationDeg(t1) - earthRotationDeg(t0)) % 360) + 360) % 360;
    expect(d).toBeCloseTo(0.9856, 2);
  });

  it("keeps the shells ordered and the Moon on the outer edge", () => {
    const leo = earthLogRadius(1 + 420 / 6371);
    const gps = earthLogRadius(1 + 20_200 / 6371);
    const geo = earthLogRadius(1 + 35_786 / 6371);
    const moon = earthLogRadius(384_400 / 6371);
    expect(leo).toBeGreaterThan(1.15);
    expect(gps).toBeGreaterThan(leo + 0.8);
    expect(geo).toBeGreaterThan(gps);
    expect(moon).toBeGreaterThan(geo + 0.5);
    expect(moon).toBeLessThan(4);
  });
});
