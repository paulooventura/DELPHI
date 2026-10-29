/**
 * Live aircraft for the orrery's world map. The world is cut into fixed ~5° cells; the server
 * asks adsb.lol once per cell (a 250 nm circle that covers it) and keeps the answer ~10 s, so
 * every phone looking at the same area shares one upstream call. Pure helpers, no fetches.
 */

export const CELL_DEG = 5;
const ROWS = 180 / CELL_DEG;
/** adsb.lol's largest point radius; a cell's half-diagonal stays under ~215 nm. */
export const CELL_RADIUS_NM = 250;
export const AIRCRAFT_TTL_MS = 10_000;
/** Above this many cells the view is too wide to poll politely. */
export const MAX_CELLS = 12;

export type Cell = { row: number; col: number };
export type CellBounds = { s: number; n: number; w: number; e: number; lat: number; lon: number };

/** Columns in a latitude row, so no cell is wider than CELL_DEG of arc at its widest edge. */
export function rowCols(row: number): number {
  const s = -90 + row * CELL_DEG;
  const edge = Math.min(Math.abs(s), Math.abs(s + CELL_DEG));
  const lat = s < 0 && s + CELL_DEG > 0 ? 0 : edge;
  return Math.max(1, Math.ceil((360 / CELL_DEG) * Math.cos((lat * Math.PI) / 180)));
}

export const cellKey = (c: Cell) => `${c.row}_${c.col}`;

export function parseCell(key: string): Cell | null {
  const m = /^(\d{1,2})_(\d{1,2})$/.exec(key);
  if (!m) return null;
  const row = Number(m[1]);
  const col = Number(m[2]);
  if (row >= ROWS || col >= rowCols(row)) return null;
  return { row, col };
}

export function cellBounds({ row, col }: Cell): CellBounds {
  const s = -90 + row * CELL_DEG;
  const step = 360 / rowCols(row);
  const w = -180 + col * step;
  return { s, n: s + CELL_DEG, w, e: w + step, lat: s + CELL_DEG / 2, lon: w + step / 2 };
}

export function cellAt(lat: number, lon: number): Cell {
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor((lat + 90) / CELL_DEG)));
  const cols = rowCols(row);
  const x = (((lon + 180) % 360) + 360) % 360;
  return { row, col: Math.min(cols - 1, Math.floor(x / (360 / cols))) };
}

/** Cells covering a view (west may exceed east across the antimeridian); null if too many. */
export function cellsForView(s: number, w: number, n: number, e: number, max = MAX_CELLS): Cell[] | null {
  const span = e >= w ? e - w : e + 360 - w;
  if (span >= 360) return null;
  const out: Cell[] = [];
  const r0 = cellAt(Math.max(-90, s), 0).row;
  const r1 = cellAt(Math.min(89.999, n), 0).row;
  if (r1 < r0) return [];
  for (let row = r0; row <= r1; row++) {
    const cols = rowCols(row);
    const lat = cellBounds({ row, col: 0 }).lat;
    const c0 = cellAt(lat, w).col;
    const c1 = cellAt(lat, e).col;
    const count = span + 360 / cols >= 360 ? cols : ((c1 - c0 + cols) % cols) + 1;
    for (let k = 0; k < count; k++) {
      out.push({ row, col: (c0 + k) % cols });
      if (out.length > max) return null;
    }
  }
  return out;
}

/**
 * One aircraft: [hex, callsign, registration, type code, lat, lon, altitude ft (0 on the ground),
 * ground speed kt, track °, vertical rate ft/min, category, squawk, flags, description, operator].
 * flags: 1 military (adsb.lol database), 2 on the ground.
 */
export type AcRow = [string, string, string, string, number, number, number, number, number, number, string, string, number, string, string];
export type AircraftCell = { cell: string; at: number; rows: AcRow[] };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const round = (v: number, k: number) => Math.round(v * k) / k;

/** adsb.lol /v2 answer → rows inside the cell; skips stale or position-less reports. */
export function parseAircraft(json: unknown, b: CellBounds): AcRow[] {
  const ac = (json as { ac?: unknown })?.ac;
  if (!Array.isArray(ac)) return [];
  const out: AcRow[] = [];
  for (const a of ac as Array<Record<string, unknown>>) {
    const lat = num(a.lat);
    const lon = num(a.lon);
    const hex = str(a.hex).toLowerCase();
    if (!hex || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (num(a.seen_pos) > 60) continue;
    if (lat < b.s || lat >= b.n || lon < b.w || lon >= b.e) continue;
    const ground = a.alt_baro === "ground";
    const altGeom = num(a.alt_geom);
    // Geometric (GPS) altitude when the feed has it; barometric drifts below zero near the ground.
    const alt = ground ? 0 : Number.isFinite(altGeom) ? altGeom : num(a.alt_baro);
    const dbFlags = num(a.dbFlags);
    const flags = (Number.isFinite(dbFlags) && dbFlags & 1 ? 1 : 0) | (ground ? 2 : 0);
    const track = num(a.track);
    const heading = Number.isFinite(track) ? track : num(a.true_heading);
    const vr = num(a.baro_rate);
    out.push([
      hex,
      str(a.flight),
      str(a.r),
      str(a.t),
      round(lat, 1e5),
      round(lon, 1e5),
      Math.round(Number.isFinite(alt) ? alt : 0),
      Number.isFinite(num(a.gs)) ? round(num(a.gs), 10) : 0,
      Number.isFinite(heading) ? round(heading, 10) : -1,
      Number.isFinite(vr) ? Math.round(vr) : Number.isFinite(num(a.geom_rate)) ? Math.round(num(a.geom_rate)) : 0,
      str(a.category),
      str(a.squawk),
      flags,
      str(a.desc),
      str(a.ownOp),
    ]);
  }
  return out;
}

export type FlightRoute = {
  callsign: string;
  from: { iata: string; icao: string; name: string; city: string; lat: number; lon: number };
  to: { iata: string; icao: string; name: string; city: string; lat: number; lon: number };
  plausible: boolean;
};

/** adsb.lol /api/0/route answer → origin and destination, or null if it has no clean pair. */
export function parseRoute(json: unknown): FlightRoute | null {
  const j = json as { callsign?: unknown; plausible?: unknown; _airports?: unknown };
  if (!j || !Array.isArray(j._airports) || j._airports.length < 2) return null;
  const ap = (a: Record<string, unknown>) => ({
    iata: str(a.iata),
    icao: str(a.icao),
    name: str(a.name),
    city: str(a.location),
    lat: num(a.lat),
    lon: num(a.lon),
  });
  const list = j._airports as Array<Record<string, unknown>>;
  const from = ap(list[0]!);
  const to = ap(list[list.length - 1]!);
  if (!from.name || !to.name) return null;
  return { callsign: str(j.callsign), from, to, plausible: j.plausible === true || j.plausible === 1 };
}

/** Card altitude: the feed's ground flag wins; small negative readings mean "at the ground". */
export function altitudeLabel(altFt: number, ground: boolean): string {
  if (ground) return "on the ground";
  if (altFt < 0 && altFt > -500) return "near ground (~0 ft)";
  if (altFt <= -500) return `${Math.round(altFt).toLocaleString("en-US")} ft (reading looks off)`;
  return `${Math.round(altFt).toLocaleString("en-US")} ft · ${Math.round(altFt * 0.3048).toLocaleString("en-US")} m`;
}

const toVec = (lat: number, lon: number) => {
  const p = (lat * Math.PI) / 180;
  const l = (lon * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)] as const;
};
const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** Km from a point to the great-circle segment between two airports. */
export function distanceToRouteKm(lat: number, lon: number, a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const A = toVec(a.lat, a.lon);
  const B = toVec(b.lat, b.lon);
  const P = toVec(lat, lon);
  const n = cross(A, B);
  const nl = Math.hypot(n[0]!, n[1]!, n[2]!);
  const ends = Math.min(haversineKm(lat, lon, a.lat, a.lon), haversineKm(lat, lon, b.lat, b.lon));
  if (nl < 1e-9) return ends;
  const N = n.map(v => v / nl);
  const s = dot(P, N);
  const C = [P[0] - s * N[0]!, P[1] - s * N[1]!, P[2] - s * N[2]!];
  const between = dot(cross(A, C), N) >= 0 && dot(cross(C, B), N) >= 0;
  return between ? 6371.0088 * Math.asin(Math.min(1, Math.abs(s))) : ends;
}

export const ROUTE_TOLERANCE_KM = 150;

/** Whether a route looks right for where the plane actually is; callsign-only routes never count as sure. */
export function routeCheck(route: FlightRoute, lat: number, lon: number): { sure: boolean; offKm: number } {
  const ok = [route.from.lat, route.from.lon, route.to.lat, route.to.lon].every(Number.isFinite);
  const offKm = ok ? distanceToRouteKm(lat, lon, route.from, route.to) : Infinity;
  return { sure: route.plausible && offKm <= ROUTE_TOLERANCE_KM, offKm };
}

/** Upstream callsigns: letters and digits only, as adsb.lol expects in the path. */
export function cleanCallsign(cs: string): string | null {
  const c = cs.trim().toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(c) ? c : null;
}

/**
 * Small keyed TTL cache with in-flight sharing: at most one load per key per ttl, and the
 * last good value is kept for `staleMs` so a failing upstream still answers (marked stale).
 */
export function createTtlCache<T>(ttlMs: number, staleMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { at: number; value: T }>();
  const inflight = new Map<string, Promise<T>>();
  return {
    async get(key: string, load: () => Promise<T>): Promise<{ value: T; fresh: boolean }> {
      const hit = hits.get(key);
      if (hit && now() - hit.at < ttlMs) return { value: hit.value, fresh: true };
      let p = inflight.get(key);
      if (!p) {
        p = load().finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      try {
        const value = await p;
        hits.set(key, { at: now(), value });
        if (hits.size > 2000) {
          for (const [k, v] of hits) if (now() - v.at > staleMs) hits.delete(k);
        }
        return { value, fresh: true };
      } catch (err) {
        if (hit && now() - hit.at < staleMs) return { value: hit.value, fresh: false };
        throw err;
      }
    },
  };
}

const R_NM = 3440.065;
/** Great-circle distance in km between two lat/lon points. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export const kmToNm = (km: number) => (km / 6371.0088) * R_NM;

/** Dead-reckon a position forward along its track (small steps; fine for seconds to minutes). */
export function deadReckon(lat: number, lon: number, trackDeg: number, gsKt: number, dtSec: number): [number, number] {
  if (trackDeg < 0 || !gsKt || !dtSec) return [lat, lon];
  const dKm = gsKt * 1.852 * (dtSec / 3600);
  const t = (trackDeg * Math.PI) / 180;
  const dLat = (dKm * Math.cos(t)) / 111.195;
  const dLon = (dKm * Math.sin(t)) / (111.195 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  let nl = lon + dLon;
  if (nl > 180) nl -= 360;
  if (nl < -180) nl += 360;
  return [lat + dLat, nl];
}
