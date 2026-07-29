import { describe, expect, it } from "vitest";
import { galacticToEquatorial, sampleMilkyWayBand } from "./milkyWay";

describe("milkyWay band", () => {
  it("places the galactic center near Sagittarius (RA ~17.8h, Dec ~−29°)", () => {
    // Galactic center is (l, b) = (0, 0).
    const gc = galacticToEquatorial(0, 0);
    expect(gc.ra).toBeGreaterThan(17.5);
    expect(gc.ra).toBeLessThan(18.1);
    expect(gc.dec).toBeGreaterThan(-31);
    expect(gc.dec).toBeLessThan(-27);
  });

  it("samples a closed band with north/south edges", () => {
    const band = sampleMilkyWayBand(10, 6);
    expect(band.center.length).toBeGreaterThan(30);
    expect(band.north.length).toBe(band.center.length);
    expect(band.south.length).toBe(band.center.length);
  });
});
