import { describe, expect, it } from "vitest";
import { Body, GeoMoon, HelioVector, JupiterMoons, MakeTime, RotateVector, Rotation_EQJ_ECL } from "astronomy-engine";
import { MINOR_BODY_ORBITS } from "./cosmic/minorBodies";
import { SKY_BODIES } from "./skyPositions";
import {
  AU_KM,
  GALAXY,
  ORRERY_BODIES,
  ORRERY_BODY_BY_ID,
  andromedaDistanceLy,
  helioEcliptic,
  logRadiusAu,
  logRadiusToAu,
  orreryFrame,
  osculatingOrbit,
  sampleHelioOrbit,
  satelliteStates,
  spinAngle,
  sunGalacticAngle,
  toLogScene,
  vecLength,
  type Vec3,
} from "./skyOrrery";
import { advanceCosmicClock, ORRERY_SPEEDS } from "./timeEngine";

const FIXED = new Date("2026-10-28T12:00:00Z");
const DAY = 86_400_000;

const eclLon = (v: Vec3) => ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360;
const sepDeg = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("sky orrery holds every body Aether shows", () => {
  it("includes the Sun, Moon, planets, Pluto, asteroids and Halley, plus Earth and the Galilean moons", () => {
    for (const b of SKY_BODIES) expect(ORRERY_BODY_BY_ID[b.id], b.id).toBeDefined();
    for (const m of MINOR_BODY_ORBITS) expect(ORRERY_BODY_BY_ID[m.id], m.id).toBeDefined();
    for (const id of ["earth", "io", "europa", "ganymede", "callisto"]) {
      expect(ORRERY_BODY_BY_ID[id], id).toBeDefined();
    }
  });

  it("every body gets a finite position at a fixed date", () => {
    const frame = orreryFrame(FIXED);
    for (const b of ORRERY_BODIES) {
      const p = frame.helio[b.id]!;
      expect(Number.isFinite(p.x + p.y + p.z), b.id).toBe(true);
    }
  });
});

describe("sky orrery real math (2026-10-28)", () => {
  it("Earth sits ~1 AU from the Sun", () => {
    const r = vecLength(helioEcliptic("earth", FIXED));
    expect(r).toBeGreaterThan(0.983);
    expect(r).toBeLessThan(1.017);
  });

  it("planet positions match astronomy-engine HelioVector rotated to the ecliptic", () => {
    const time = MakeTime(FIXED);
    for (const [id, body] of [
      ["mercury", Body.Mercury],
      ["earth", Body.Earth],
      ["jupiter", Body.Jupiter],
      ["neptune", Body.Neptune],
    ] as const) {
      const ref = RotateVector(Rotation_EQJ_ECL(), HelioVector(body, time));
      const ours = helioEcliptic(id, FIXED);
      const err = Math.hypot(ours.x - ref.x, ours.y - ref.y, ours.z - ref.z);
      expect(err, id).toBeLessThan(1e-6);
    }
  });

  it("the Moon is ~384,400 km from Earth and matches GeoMoon", () => {
    const moon = satelliteStates(FIXED).moon!;
    const km = vecLength(moon.pos) * AU_KM;
    expect(km).toBeGreaterThan(356_000);
    expect(km).toBeLessThan(407_000);
    const ref = GeoMoon(MakeTime(FIXED));
    expect(Math.abs(km - Math.hypot(ref.x, ref.y, ref.z) * AU_KM)).toBeLessThan(1);
  });

  it("Galilean moons sit at their real distances from Jupiter", () => {
    const sats = satelliteStates(FIXED);
    const expectKm: Record<string, number> = {
      io: 421_700,
      europa: 671_034,
      ganymede: 1_070_412,
      callisto: 1_882_709,
    };
    for (const [id, km] of Object.entries(expectKm)) {
      const got = vecLength(sats[id]!.pos) * AU_KM;
      expect(Math.abs(got - km) / km, id).toBeLessThan(0.03);
    }
    const ref = JupiterMoons(MakeTime(FIXED)).io;
    expect(Math.abs(vecLength(sats.io!.pos) - Math.hypot(ref.x, ref.y, ref.z))).toBeLessThan(1e-9);
  });

  it("orbital periods are sane: Earth and Mars return to the same longitude after one period", () => {
    for (const id of ["earth", "mars"]) {
      const period = ORRERY_BODY_BY_ID[id]!.periodDays;
      const a = eclLon(helioEcliptic(id, FIXED));
      const b = eclLon(helioEcliptic(id, new Date(FIXED.getTime() + period * DAY)));
      expect(sepDeg(a, b), id).toBeLessThan(0.6);
    }
    expect(ORRERY_BODY_BY_ID.earth!.periodDays).toBeCloseTo(365.256, 2);
    expect(ORRERY_BODY_BY_ID.moon!.periodDays).toBeCloseTo(27.32, 1);
  });

  it("the Moon circles Earth: about half a lap in two weeks", () => {
    const a = eclLon(satelliteStates(FIXED).moon!.pos);
    const b = eclLon(satelliteStates(new Date(FIXED.getTime() + 13.66 * DAY)).moon!.pos);
    expect(sepDeg(a, b)).toBeGreaterThan(150);
  });

  it("sampled Earth orbit closes on itself and stays near 1 AU", () => {
    const path = sampleHelioOrbit("earth", FIXED, 64);
    const first = path[0]!;
    const last = path[path.length - 1]!;
    expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(0.01);
    for (const p of path) expect(Math.abs(vecLength(p) - 1)).toBeLessThan(0.02);
  });

  it("the Moon's osculating ellipse passes through the Moon", () => {
    const moon = satelliteStates(FIXED).moon!;
    const path = osculatingOrbit(moon.pos, moon.vel, moon.mu, 360);
    const nearest = Math.min(
      ...path.map(p => Math.hypot(p.x - moon.pos.x, p.y - moon.pos.y, p.z - moon.pos.z)),
    );
    expect(nearest * AU_KM).toBeLessThan(5_000);
  });

  it("Halley's comet is far out near aphelion in 2026, not at perihelion", () => {
    const r = vecLength(helioEcliptic("halley", FIXED));
    expect(r).toBeGreaterThan(30);
    expect(r).toBeLessThan(36);
  });
});

describe("sky orrery scale + time", () => {
  it("log scale keeps the planets in order and round-trips", () => {
    const frame = orreryFrame(FIXED);
    const order = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
    const logR = order.map(id => vecLength(toLogScene(frame.helio[id]!)));
    for (let i = 1; i < logR.length; i++) expect(logR[i]!).toBeGreaterThan(logR[i - 1]!);
    expect(logRadiusToAu(logRadiusAu(5.2))).toBeCloseTo(5.2, 9);
  });

  it("Earth turns once per sidereal day", () => {
    const earth = ORRERY_BODY_BY_ID.earth!;
    const a = spinAngle(earth, FIXED);
    const b = spinAngle(earth, new Date(FIXED.getTime() + earth.rotationDays * DAY));
    expect(Math.abs(Math.sin((a - b) / 2))).toBeLessThan(1e-6);
  });

  it("cosmic clock advances by the chosen rate", () => {
    const year = ORRERY_SPEEDS.find(s => s.id === "year")!;
    const next = advanceCosmicClock(FIXED.getTime(), year.daysPerSec, 2);
    expect((next - FIXED.getTime()) / DAY).toBeCloseTo(2 * 365.2422, 6);
  });

  it("the Sun laps Sgr A* once per ~230 million years; Andromeda closes in", () => {
    expect(GALAXY.sunRadiusLy).toBeCloseTo(26_000, -3);
    const half = sunGalacticAngle(GALAXY.galacticYearYears / 2) - sunGalacticAngle(0);
    expect(Math.abs(half)).toBeCloseTo(Math.PI, 9);
    expect(andromedaDistanceLy(0)).toBeCloseTo(2.537e6, -3);
    expect(andromedaDistanceLy(1e9)).toBeLessThan(andromedaDistanceLy(0));
  });
});
