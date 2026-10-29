import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCatalogBodies,
  cloudRowPosition,
  dateToJd,
  parseStars,
  periodDaysFromPerihelion,
  perihelionElementsToPos,
  solveEllipticE,
  type CloudJson,
  type CraftJson,
  type MoonJson,
  type SbdbBodyJson,
  type StarsJson,
} from "./orreryCatalog";
import { OrreryIndex, distanceBetween, measureBody } from "./orreryMeasure";
import { AU_KM, vecLength } from "./skyOrrery";

const load = <T,>(name: string): T =>
  JSON.parse(readFileSync(path.join(__dirname, "..", "public", "orrery", `${name}.json`), "utf8")) as T;

const bodies = load<{ bodies: SbdbBodyJson[] }>("bodies").bodies;
const moons = load<{ moons: MoonJson[] }>("moons").moons;
const craft = load<{ craft: CraftJson[] }>("spacecraft").craft;
const asteroids = load<CloudJson>("asteroids");
const kuiper = load<CloudJson>("kuiper");
const stars = parseStars(load<StarsJson>("stars"));
const index = new OrreryIndex(buildCatalogBodies(bodies, moons, craft));

const FIXED = new Date("2026-10-28T12:00:00Z");
const JD = dateToJd(FIXED);

describe("orrery catalogs are present and sized", () => {
  it("carries the layers Paulo asked for", () => {
    expect(stars.length).toBeGreaterThan(9000);
    expect(moons.length).toBeGreaterThanOrEqual(20);
    expect(bodies.filter(b => b.kind === "comet").length).toBeGreaterThanOrEqual(30);
    expect(bodies.filter(b => b.kind === "dwarf").length).toBe(7);
    expect(asteroids.rows.length / asteroids.stride).toBeGreaterThan(15000);
    expect(kuiper.rows.length / kuiper.stride).toBeGreaterThan(3000);
    expect(craft.map(c => c.id).sort()).toEqual(["newhorizons", "pioneer10", "pioneer11", "voyager1", "voyager2"]);
  });

  it("knows the bright stars by name", () => {
    const sirius = stars.find(s => s.name === "Sirius")!;
    expect(sirius.vmag).toBeLessThan(-1.3);
    expect(sirius.con).toBe("CMa");
    expect(sirius.distLy).toBeGreaterThan(7);
    expect(sirius.distLy).toBeLessThan(10);
  });
});

describe("moons sit at their real distances from their planets", () => {
  const km = (id: string) => vecLength(index.relAt(id, JD)!) * AU_KM;
  it("Titan ~1.22 million km from Saturn", () => {
    expect(Math.abs(km("titan") - 1_221_870) / 1_221_870).toBeLessThan(0.04);
  });
  it("Triton ~354,800 km from Neptune", () => {
    expect(Math.abs(km("triton") - 354_759) / 354_759).toBeLessThan(0.01);
  });
  it("Phobos ~9,376 km from Mars, Charon ~19,600 km from Pluto", () => {
    expect(Math.abs(km("phobos") - 9376) / 9376).toBeLessThan(0.03);
    expect(Math.abs(km("charon") - 19_596) / 19_596).toBeLessThan(0.01);
  });
  it("Titan laps Saturn in ~15.95 days", () => {
    expect(index.byId.get("titan")!.periodDays).toBeCloseTo(15.945, 1);
  });
});

describe("comets, asteroids and spacecraft", () => {
  it("Encke returns every ~3.3 years; Swift–Tuttle every ~133", () => {
    const encke = bodies.find(b => b.id === "encke")!;
    expect(periodDaysFromPerihelion(encke.el)! / 365.25).toBeCloseTo(3.3, 1);
    const st = bodies.find(b => b.id === "swifttuttle")!;
    expect(periodDaysFromPerihelion(st.el)! / 365.25).toBeGreaterThan(125);
    expect(periodDaysFromPerihelion(st.el)! / 365.25).toBeLessThan(140);
  });

  it("hyperbolic visitors keep a finite path ('Oumuamua outbound)", () => {
    const o = bodies.find(b => b.id === "oumuamua")!;
    const r = vecLength(perihelionElementsToPos(o.el, JD));
    expect(r).toBeGreaterThan(20);
    expect(Number.isFinite(r)).toBe(true);
  });

  // Horizons: ~166 AU in late 2024, receding ~3.6 AU/yr → ~172 AU by late 2026.
  it("Voyager 1 is ~165–176 AU from the Sun in late 2026; New Horizons ~60–65", () => {
    const v1 = vecLength(index.helioAt("voyager1", JD)!);
    expect(v1).toBeGreaterThan(165);
    expect(v1).toBeLessThan(176);
    const nh = vecLength(index.helioAt("newhorizons", JD)!);
    expect(nh).toBeGreaterThan(58);
    expect(nh).toBeLessThan(66);
  });

  it("spacecraft do not exist before launch", () => {
    expect(index.helioAt("voyager1", dateToJd(new Date("1970-01-01")))).toBeNull();
  });

  it("asteroid cloud rows obey Kepler: inside perihelion–aphelion, same place one period later", () => {
    const days = JD - asteroids.epochJd;
    for (const k of [0, 1, 500, 7000, 15000]) {
      const a = asteroids.rows[k * 7]! / 1e4;
      const e = asteroids.rows[k * 7 + 1]! / 1e4;
      const r = vecLength(cloudRowPosition(asteroids.rows, k, days));
      expect(r).toBeGreaterThanOrEqual(a * (1 - e) - 1e-6);
      expect(r).toBeLessThanOrEqual(a * (1 + e) + 1e-6);
      const period = 365.256898 * a ** 1.5;
      const p0 = cloudRowPosition(asteroids.rows, k, days);
      const p1 = cloudRowPosition(asteroids.rows, k, days + period);
      expect(Math.hypot(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z)).toBeLessThan(1e-3 * a);
    }
  });

  it("Kepler solver round-trips", () => {
    const E = solveEllipticE(1.2, 0.95);
    expect(E - 0.95 * Math.sin(E)).toBeCloseTo(1.2, 10);
  });
});

describe("Centaurs", () => {
  const centaurs = load<CloudJson>("centaurs");
  it("a cloud of 1,000+ Centaurs, all between Jupiter and Neptune", () => {
    const n = centaurs.rows.length / centaurs.stride;
    expect(n).toBeGreaterThan(1000);
    for (let k = 0; k < n; k++) {
      const a = centaurs.rows[k * 7]! / 1e4;
      expect(a).toBeGreaterThan(5.5);
      expect(a).toBeLessThan(30.2);
    }
  });
  it("Chiron and Pholus are named, measurable bodies", () => {
    const chiron = measureBody(index, "chiron", FIXED)!;
    expect(chiron.kind).toBe("centaur");
    expect(chiron.periodDays! / 365.25).toBeGreaterThan(48);
    expect(chiron.periodDays! / 365.25).toBeLessThan(53);
    expect(chiron.diameterKm).toBeGreaterThan(100);
    expect(chiron.magnitude!).toBeGreaterThan(15);
    expect(chiron.magnitude!).toBeLessThan(20);
    expect(measureBody(index, "pholus", FIXED)!.distSunAu).toBeGreaterThan(8);
  });
});

describe("moon brightness from Earth", () => {
  const mag = (id: string, iso: string) => measureBody(index, id, new Date(iso))!.magnitude!;
  it("Titan ~8.4 at Saturn's 2026 opposition", () => {
    expect(mag("titan", "2026-10-04T00:00:00Z")).toBeGreaterThan(8.1);
    expect(mag("titan", "2026-10-04T00:00:00Z")).toBeLessThan(8.6);
  });
  it("Triton ~13.5 at Neptune's 2026 opposition", () => {
    expect(mag("triton", "2026-09-26T00:00:00Z")).toBeGreaterThan(13.2);
    expect(mag("triton", "2026-09-26T00:00:00Z")).toBeLessThan(13.8);
  });
  it("Phobos ~12 at Mars' 2027 opposition (a distant one)", () => {
    expect(mag("phobos", "2027-02-19T00:00:00Z")).toBeGreaterThan(11);
    expect(mag("phobos", "2027-02-19T00:00:00Z")).toBeLessThan(12.5);
  });
  it("Ganymede ~4.6 at Jupiter's 2026 opposition", () => {
    expect(mag("ganymede", "2026-01-10T00:00:00Z")).toBeGreaterThan(4.3);
    expect(mag("ganymede", "2026-01-10T00:00:00Z")).toBeLessThan(5);
  });
  it("every moon gets a finite magnitude", () => {
    for (const b of index.bodies.filter(x => x.kind === "moon")) {
      expect(Number.isFinite(measureBody(index, b.id, FIXED)!.magnitude), b.id).toBe(true);
    }
  });
});

describe("measurement card", () => {
  it("Moon: ~384,400 km from Earth, ~1.28 light-seconds, ~1 km/s around Earth, ~27.3 day lap", () => {
    const m = measureBody(index, "moon", FIXED)!;
    expect(m.distParentKm!).toBeGreaterThan(356_000);
    expect(m.distParentKm!).toBeLessThan(407_000);
    expect(Math.abs(m.distEarthAu * AU_KM - m.distParentKm!)).toBeLessThan(1);
    expect(m.lightTimeSec).toBeGreaterThan(1.18);
    expect(m.lightTimeSec).toBeLessThan(1.36);
    expect(m.speedParentKmS!).toBeGreaterThan(0.95);
    expect(m.speedParentKmS!).toBeLessThan(1.1);
    expect(m.periodDays!).toBeGreaterThan(26);
    expect(m.periodDays!).toBeLessThan(29);
    expect(m.diameterKm).toBeCloseTo(3474.8, 0);
    expect(m.magnitude!).toBeLessThan(-2);
  });

  it("Earth: ~1 AU, ~29.8 km/s, e ~0.017, year-long orbit", () => {
    const m = measureBody(index, "earth", FIXED)!;
    expect(m.distSunAu).toBeGreaterThan(0.98);
    expect(m.distSunAu).toBeLessThan(1.02);
    expect(m.speedKmS).toBeGreaterThan(29);
    expect(m.speedKmS).toBeLessThan(30.5);
    expect(m.e!).toBeLessThan(0.03);
    expect(m.periodDays!).toBeGreaterThan(360);
    expect(m.periodDays!).toBeLessThan(370);
  });

  it("comets get a next perihelion; Voyager 1 gets ~17 km/s and its launch year", () => {
    const enc = measureBody(index, "encke", FIXED)!;
    expect(enc.nextPerihelion!.getTime()).toBeGreaterThanOrEqual(FIXED.getTime());
    expect(enc.perihelionReturns).toBe(true);
    const v1 = measureBody(index, "voyager1", FIXED)!;
    expect(v1.speedKmS).toBeGreaterThan(16);
    expect(v1.speedKmS).toBeLessThan(18);
    expect(v1.launch).toBe(1977);
  });

  it("A–B distance: Earth to Moon equals the Moon's distance from Earth", () => {
    const d = distanceBetween(index.helioAt("earth", JD)!, index.helioAt("moon", JD)!);
    const m = measureBody(index, "moon", FIXED)!;
    expect(Math.abs(d.km - m.distParentKm!)).toBeLessThan(1);
  });
});
