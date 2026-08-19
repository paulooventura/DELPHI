import { describe, expect, it, beforeEach } from "vitest";
import { Body, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";
import { BRIGHT_STARS } from "./brightStars";
import {
  HOME_ALT_M,
  HOME_DECLINATION_DEG,
  HOME_LAT,
  HOME_LON,
  HOME_OBSERVER,
  angularSeparationDeg,
  formatHomeSkyDump,
  homeSkyTargets,
  hourAngleAltAz,
  lookErrorDeg,
  matrixLookAtHeading,
  projectTargetToCrosshair,
  shortestDeg,
  simulateIosLookAt,
  sunOnMeridian,
} from "./skyAccuracy";
import {
  resetOrientationCalibration,
  setMagneticDeclinationDeg,
} from "./orientationCalibration";
import { bodyEquatorHorizon, j2000ToOfDateRaDec, raDecToAltAz } from "./skyPositions";

const NASHVILLE_EVENING = new Date("2026-08-19T01:00:00Z"); // 8pm CDT Aug 18

describe("home observer sky accuracy (Nashville)", () => {
  beforeEach(() => {
    resetOrientationCalibration();
    setMagneticDeclinationDeg(HOME_DECLINATION_DEG);
  });

  it("dumps the live home sky so the agent can check it", () => {
    const frozen = formatHomeSkyDump(NASHVILLE_EVENING);
    const live = formatHomeSkyDump(new Date());
    // Visible in vitest output — this is how we verify without a phone.
    console.log(`\n${frozen}\n\n--- now ---\n${live}\n`);
    expect(frozen).toMatch(/Nashville/);
    expect(live).toMatch(/Polaris/);
  });

  it("Polaris sits near latitude altitude from Nashville", () => {
    const polaris = BRIGHT_STARS.find(s => s.id === "polaris")!;
    const hor = raDecToAltAz(
      NASHVILLE_EVENING,
      HOME_LAT,
      HOME_LON,
      polaris.ra,
      polaris.dec,
      HOME_ALT_M,
      "j2000",
    );
    // Pole star altitude ≈ latitude; Polaris is ~0.7° off the pole.
    expect(Math.abs(hor.alt - HOME_LAT)).toBeLessThan(1.6);
    expect(hor.alt).toBeGreaterThan(34);
    expect(hor.alt).toBeLessThan(38);
  });

  it("Sun on the meridian is due south from Nashville", () => {
    const noon = sunOnMeridian(NASHVILLE_EVENING);
    expect(Math.abs(shortestDeg(noon.az, 180))).toBeLessThan(1.2);
    expect(noon.alt).toBeGreaterThan(20);
  });

  it("astronomy-engine of-date Sun matches the independent hour-angle formula", () => {
    const observer = new Observer(HOME_LAT, HOME_LON, HOME_ALT_M);
    const time = MakeTime(NASHVILLE_EVENING);
    const eq = Equator(Body.Sun, time, observer, true, true);
    const engine = Horizon(time, observer, eq.ra, eq.dec, "");
    const independent = hourAngleAltAz(NASHVILLE_EVENING, HOME_LAT, HOME_LON, eq.ra, eq.dec);
    expect(angularSeparationDeg(engine.azimuth, engine.altitude, independent.az, independent.alt)).toBeLessThan(0.35);
  });

  it("J2000 stars are precessed before Horizon (Vega moves ~0.3°+ by 2026)", () => {
    const vega = BRIGHT_STARS.find(s => s.id === "vega")!;
    const raw = raDecToAltAz(
      NASHVILLE_EVENING, HOME_LAT, HOME_LON, vega.ra, vega.dec, HOME_ALT_M, "ofdate",
    );
    const precessed = raDecToAltAz(
      NASHVILLE_EVENING, HOME_LAT, HOME_LON, vega.ra, vega.dec, HOME_ALT_M, "j2000",
    );
    const ofdate = j2000ToOfDateRaDec(NASHVILLE_EVENING, vega.ra, vega.dec);
    expect(Math.hypot((ofdate.raHours - vega.ra) * 15, ofdate.decDeg - vega.dec)).toBeGreaterThan(0.2);
    expect(angularSeparationDeg(raw.az, raw.alt, precessed.az, precessed.alt)).toBeGreaterThan(0.12);
  });

  it("iOS look vector hits the Moon when the phone is aimed at it", () => {
    const moon = bodyEquatorHorizon(Body.Moon, NASHVILLE_EVENING, HOME_LAT, HOME_LON, HOME_ALT_M);
    const event = simulateIosLookAt(moon.az, moon.alt, HOME_DECLINATION_DEG);
    const miss = lookErrorDeg(event, moon.az, moon.alt);
    expect(miss.errorDeg).toBeLessThan(0.8);
  });

  it("iOS look vector hits Polaris when the phone is aimed at it", () => {
    const polaris = homeSkyTargets(NASHVILLE_EVENING).find(t => t.id === "polaris")!;
    expect(polaris.alt).toBeGreaterThan(30);
    const event = simulateIosLookAt(polaris.az, polaris.alt, HOME_DECLINATION_DEG);
    const miss = lookErrorDeg(event, polaris.az, polaris.alt);
    expect(miss.errorDeg).toBeLessThan(0.8);
  });

  it("lying webkit heading while tilted does not yank the look off the star", () => {
    const vega = homeSkyTargets(NASHVILLE_EVENING).find(t => t.id === "vega")!;
    const event = simulateIosLookAt(vega.az, vega.alt, HOME_DECLINATION_DEG);
    const miss = lookErrorDeg(event, vega.az, vega.alt);
    expect(miss.errorDeg).toBeLessThan(1.0);
  });

  it("a target on the look ray lands on the canvas crosshair", () => {
    const lookAz = 210;
    const lookAlt = 35;
    const hit = projectTargetToCrosshair(lookAz, lookAlt, lookAz, lookAlt);
    expect(Math.abs(hit.dx)).toBeLessThan(1.5);
    expect(Math.abs(hit.dy)).toBeLessThan(1.5);
  });

  it("Euler matrix with γ=0 looks along true heading", () => {
    const look = matrixLookAtHeading(114, 12);
    expect(Math.abs(shortestDeg(look.az, 114))).toBeLessThan(0.4);
    expect(Math.abs(look.alt - 12)).toBeLessThan(0.4);
  });

  it("home sky dump names the observer we test against", () => {
    expect(HOME_OBSERVER.label).toMatch(/Nashville/);
    const up = homeSkyTargets(NASHVILLE_EVENING).filter(t => t.alt > 0);
    expect(up.length).toBeGreaterThan(2);
  });
});
