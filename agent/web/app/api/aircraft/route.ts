import { NextResponse } from "next/server";
import {
  ADSB_ODBL,
  AIRCRAFT_TTL_MS,
  CELL_RADIUS_NM,
  cellBounds,
  createTtlCache,
  parseAircraft,
  parseCell,
  type AircraftCell,
} from "../../../lib/aircraft";

/**
 * Live aircraft for one ~5° map cell from adsb.lol (ODbL 1.0). One upstream call per cell
 * per ~10 s per server instance, and the CDN shares that answer between phones.
 * Phones only ever talk to this route, never to adsb.lol.
 */
const UA = "PneumaMundi-orrery/1.0 (+https://pauloventura.org)";
const cache = createTtlCache<AircraftCell>(AIRCRAFT_TTL_MS, 5 * 60_000);

async function load(key: string): Promise<AircraftCell> {
  const b = cellBounds(parseCell(key)!);
  const url = `https://api.adsb.lol/v2/point/${b.lat.toFixed(3)}/${b.lon.toFixed(3)}/${CELL_RADIUS_NM}`;
  const res = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const j = (await res.json()) as { now?: number };
  return { cell: key, at: typeof j.now === "number" ? j.now : Date.now(), rows: parseAircraft(j, b) };
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("cell") ?? "";
  if (!parseCell(key)) return NextResponse.json({ error: "unknown cell" }, { status: 400 });
  try {
    const { value, fresh } = await cache.get(key, () => load(key));
    return NextResponse.json({ ...value, ...ADSB_ODBL }, {
      headers: { "Cache-Control": fresh ? "public, s-maxage=10, stale-while-revalidate=20" : "public, s-maxage=5" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
