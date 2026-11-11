import { describe, expect, it } from "vitest";
import { BRIGHT_STARS } from "../brightStars";
import { STAR_MOTION } from "../starMotion";
import { raDecToAltAz } from "../skyPositions";
import { driftFigurePoint, driftRaDec, isDeepSky, yearsFromJ2000 } from "./starDrift";

const star = (id: string) => BRIGHT_STARS.find(s => s.id === id)!;
const atYear = (y: number) => {
  const d = new Date(Date.UTC(2000, 0, 1, 12));
  d.setUTCFullYear(y);
  return d;
};

describe("starDrift", () => {
  it("has a proper motion for every bright star", () => {
    for (const s of BRIGHT_STARS) expect(STAR_MOTION[s.id], s.id).toBeDefined();
  });

  it("leaves stars where they are near today", () => {
    const a = star("arcturus");
    expect(driftRaDec("arcturus", a.ra, a.dec, 26)).toEqual({ ra: a.ra, dec: a.dec });
  });

  it("moves Arcturus about 8 degrees over 13,000 years, southward going forward", () => {
    const a = star("arcturus");
    const later = driftRaDec("arcturus", a.ra, a.dec, 13_000);
    expect(a.dec - later.dec).toBeGreaterThan(6.5);
    expect(a.dec - later.dec).toBeLessThan(8);
  });

  it("moves line ends with the star they mark", () => {
    const a = star("arcturus");
    const p = driftFigurePoint(a.ra, a.dec, -13_000);
    expect(p.dec).toBeGreaterThan(a.dec + 6);
  });

  it("with precession, puts Vega within about 6 degrees of the pole 14,000 years ago", () => {
    const v = star("vega");
    const date = atYear(-12000);
    const moved = driftRaDec("vega", v.ra, v.dec, yearsFromJ2000(date));
    // seen from the North Pole, a star's altitude is its declination of date
    const { alt } = raDecToAltAz(date, 90, 0, moved.ra, moved.dec);
    expect(alt).toBeGreaterThan(84);
  });

  it("knows when the sky is far from today", () => {
    expect(isDeepSky(atYear(2026))).toBe(false);
    expect(isDeepSky(atYear(-500))).toBe(true);
  });
});
