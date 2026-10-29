import { NextResponse } from "next/server";
import { ADSB_ODBL, cleanCallsign, createTtlCache, parseRoute, type FlightRoute } from "../../../../../lib/aircraft";

/**
 * Origin and destination for a callsign, from adsb.lol's route database (ODbL 1.0).
 * Asked only when someone opens an aircraft's card; cached 6 h per callsign.
 */
const UA = "PneumaMundi-orrery/1.0 (+https://pauloventura.org)";
const cache = createTtlCache<FlightRoute | null>(6 * 3_600_000, 24 * 3_600_000);

export async function GET(req: Request, { params }: { params: Promise<{ callsign: string }> }) {
  const cs = cleanCallsign((await params).callsign);
  if (!cs) return NextResponse.json({ error: "bad callsign" }, { status: 400 });
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const at = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? `/${lat.toFixed(2)}/${lon.toFixed(2)}` : "/0/0";
  try {
    const { value } = await cache.get(cs, async () => {
      const res = await fetch(`https://api.adsb.lol/api/0/route/${cs}${at}`, {
        headers: { "user-agent": UA },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
      return parseRoute(await res.json());
    });
    return NextResponse.json({ route: value, ...ADSB_ODBL }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
