import { describe, expect, it } from "vitest";
import {
  ADSB_ODBL,
  altitudeLabel,
  distanceToRouteKm,
  routeCheck,
  CELL_RADIUS_NM,
  cellAt,
  cellBounds,
  cellKey,
  cellsForView,
  cleanCallsign,
  createTtlCache,
  deadReckon,
  haversineKm,
  kmToNm,
  parseAircraft,
  parseCell,
  parseRoute,
  rowCols,
} from "./aircraft";

const SAMPLE = {
  now: 1793269701501,
  ac: [
    { hex: "AC96BE", flight: "AAL1597 ", r: "N910AU", t: "A321", alt_baro: 29725, gs: 424.1, track: 238.6, baro_rate: 832, squawk: "2647", category: "A3", lat: 40.23049, lon: -76.056976, seen_pos: 0.2 },
    { hex: "a1270a", flight: "UAL1802", r: "N17321", t: "B38M", alt_baro: "ground", gs: 12, true_heading: 90, lat: 40.6, lon: -73.78, seen_pos: 1, dbFlags: 1, ownOp: "United States Navy", desc: "BOEING 737 MAX 8" },
    { hex: "abc123", alt_baro: 10000, lat: 40, lon: -75, seen_pos: 120 },
    { hex: "def456", alt_baro: 10000 },
    { hex: "0f0f0f", alt_baro: 35000, lat: 50.5, lon: -75, seen_pos: 1 },
  ],
};

describe("aircraft cells", () => {
  it("covers every cell with the 250 nm query circle", () => {
    for (let row = 0; row < 36; row++) {
      for (let col = 0; col < rowCols(row); col++) {
        const b = cellBounds({ row, col });
        const corners = [
          [b.s, b.w],
          [b.s, b.e],
          [b.n, b.w],
          [b.n, b.e],
        ] as const;
        for (const [la, lo] of corners) expect(kmToNm(haversineKm(b.lat, b.lon, la, lo))).toBeLessThan(CELL_RADIUS_NM);
      }
    }
  });

  it("maps points to cells and back", () => {
    const c = cellAt(40.7, -74);
    const b = cellBounds(c);
    expect(b.s).toBeLessThanOrEqual(40.7);
    expect(b.n).toBeGreaterThan(40.7);
    expect(b.w).toBeLessThanOrEqual(-74);
    expect(b.e).toBeGreaterThan(-74);
    expect(parseCell(cellKey(c))).toEqual(c);
    expect(parseCell("99_0")).toBeNull();
    expect(parseCell("1_1; drop")).toBeNull();
    expect(parseCell(`0_${rowCols(0)}`)).toBeNull();
  });

  it("lists cells for a view, across the antimeridian, and refuses wide views", () => {
    const nyc = cellsForView(39, -76, 42, -72)!;
    expect(nyc.length).toBeGreaterThan(0);
    expect(nyc.length).toBeLessThanOrEqual(4);
    const pacific = cellsForView(-2, 178, 2, -178)!;
    const cols = pacific.map(c => cellBounds(c));
    expect(cols.some(b => b.w >= 170)).toBe(true);
    expect(cols.some(b => b.e <= -170)).toBe(true);
    expect(cellsForView(-60, -180, 60, 179)).toBeNull();
  });
});

describe("aircraft parsing", () => {
  it("keeps positioned, recent aircraft inside the cell", () => {
    const rows = parseAircraft(SAMPLE, { s: 35, n: 45, w: -80, e: -70, lat: 40, lon: -75 });
    expect(rows.map(r => r[0])).toEqual(["ac96be", "a1270a"]);
    const [aal, ual] = rows;
    expect(aal![1]).toBe("AAL1597");
    expect(aal![2]).toBe("N910AU");
    expect(aal![6]).toBe(29725);
    expect(aal![7]).toBe(424.1);
    expect(aal![8]).toBe(238.6);
    expect(aal![12]).toBe(0);
    expect(ual![6]).toBe(0);
    expect(ual![8]).toBe(90);
    expect(ual![12]).toBe(3);
    expect(ual![14]).toBe("United States Navy");
    expect(parseAircraft({ msg: "nope" }, { s: 0, n: 1, w: 0, e: 1, lat: 0, lon: 0 })).toEqual([]);
  });

  it("reads a clean route and rejects partial ones", () => {
    const r = parseRoute({
      callsign: "AAL1597",
      plausible: true,
      _airports: [
        { iata: "LGA", icao: "KLGA", name: "La Guardia Airport", location: "New York", lat: 40.77, lon: -73.87 },
        { iata: "DFW", icao: "KDFW", name: "Dallas Fort Worth International Airport", location: "Dallas-Fort Worth", lat: 32.9, lon: -97.04 },
      ],
    })!;
    expect(r.from.iata).toBe("LGA");
    expect(r.to.city).toBe("Dallas-Fort Worth");
    expect(r.plausible).toBe(true);
    expect(parseRoute({ _airports: [{ name: "x" }] })).toBeNull();
    expect(cleanCallsign(" aal1597 ")).toBe("AAL1597");
    expect(cleanCallsign("../etc")).toBeNull();
  });

  it("labels altitude: ground flag, small negative readings, geometric first", () => {
    expect(altitudeLabel(0, true)).toBe("on the ground");
    expect(altitudeLabel(-350, false)).toBe("near ground (~0 ft)");
    expect(altitudeLabel(29725, false)).toBe("29,725 ft · 9,060 m");
    const b = { s: 35, n: 45, w: -80, e: -70, lat: 40, lon: -75 };
    const [row] = parseAircraft({ ac: [{ hex: "aa127e", alt_baro: -350, alt_geom: 125, lat: 40.69, lon: -74.17, seen_pos: 1 }] }, b);
    expect(row![6]).toBe(125);
    const [baroOnly] = parseAircraft({ ac: [{ hex: "aa127f", alt_baro: -350, lat: 40.69, lon: -74.17, seen_pos: 1 }] }, b);
    expect(altitudeLabel(baroOnly![6], false)).toBe("near ground (~0 ft)");
  });

  it("flags a route that does not pass near the plane", () => {
    const ap = (iata: string, lat: number, lon: number) => ({ iata, icao: `K${iata}`, name: iata, city: iata, lat, lon });
    const cltOrd = { callsign: "RPA3421", from: ap("CLT", 35.214, -80.943), to: ap("ORD", 41.979, -87.905), plausible: true };
    // Landing at Newark: hundreds of km off the Charlotte → Chicago line.
    const ewr = routeCheck(cltOrd, 40.69, -74.17);
    expect(ewr.sure).toBe(false);
    expect(ewr.offKm).toBeGreaterThan(500);
    // Over Kentucky / Ohio, on the way.
    expect(routeCheck(cltOrd, 38.6, -84.4).sure).toBe(true);
    // Callsign-only routes are never sure, even on the line.
    expect(routeCheck({ ...cltOrd, plausible: false }, 38.6, -84.4).sure).toBe(false);
    // Past the end of the segment counts distance to the nearest airport.
    expect(distanceToRouteKm(43, -89, cltOrd.from, cltOrd.to)).toBeCloseTo(haversineKm(43, -89, 41.979, -87.905), 0);
  });

  it("dead-reckons along the track", () => {
    const [lat, lon] = deadReckon(0, 0, 90, 480, 3600);
    expect(lat).toBeCloseTo(0, 5);
    expect(haversineKm(0, 0, lat, lon)).toBeCloseTo(480 * 1.852, 0);
    expect(deadReckon(10, 10, -1, 400, 60)).toEqual([10, 10]);
  });
});

describe("aircraft cache", () => {
  it("makes one upstream call per key per ttl and shares in-flight loads", async () => {
    let t = 0;
    let calls = 0;
    const cache = createTtlCache<number>(10_000, 60_000, () => t);
    const load = async () => ++calls;
    const [a, b] = await Promise.all([cache.get("k", load), cache.get("k", load)]);
    expect(a.value).toBe(1);
    expect(b.value).toBe(1);
    t = 9_000;
    expect((await cache.get("k", load)).value).toBe(1);
    t = 10_500;
    expect((await cache.get("k", load)).value).toBe(2);
    expect(calls).toBe(2);
    expect((await cache.get("other", load)).value).toBe(3);
  });

  it("serves the last good answer, marked stale, when the upstream fails", async () => {
    let t = 0;
    const cache = createTtlCache<string>(10_000, 60_000, () => t);
    await cache.get("k", async () => "good");
    t = 20_000;
    const r = await cache.get("k", async () => {
      throw new Error("down");
    });
    expect(r).toEqual({ value: "good", fresh: false });
    t = 100_000;
    await expect(
      cache.get("k", async () => {
        throw new Error("down");
      }),
    ).rejects.toThrow("down");
  });
});

describe("ODbL notice on our aircraft feed", () => {
  it("names adsb.lol, the licence and its link, and offers our feed on the same terms", () => {
    expect(ADSB_ODBL.licence).toBe("ODbL-1.0");
    expect(ADSB_ODBL.licence_url).toBe("https://opendatacommons.org/licenses/odbl/1-0/");
    expect(ADSB_ODBL.attribution).toMatch(/adsb\.lol.*Open Database License/);
    expect(ADSB_ODBL.terms).toMatch(/ODbL/);
  });
});
