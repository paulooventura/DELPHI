import { NextResponse } from "next/server";
import { compactAurora, compactQuakes, type EarthFeed } from "../../../../lib/earthFeeds";

/**
 * Public live layers for the world map (T473), cached here so phones only talk to Pneuma's server:
 *   quakes: USGS earthquakes, magnitude 2.5+ in the past day (public domain, earthquake.usgs.gov)
 *   aurora: NOAA SWPC OVATION aurora forecast, the next ~30-90 minutes (public domain, swpc.noaa.gov)
 */
const FEEDS: Record<string, { url: string; ttlMs: number; compact: (j: unknown) => EarthFeed }> = {
  quakes: {
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    ttlMs: 5 * 60_000,
    compact: compactQuakes,
  },
  aurora: {
    url: "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json",
    ttlMs: 10 * 60_000,
    compact: compactAurora,
  },
};

const UA = "PneumaMundi-map/1.0 (+https://pauloventura.org)";
const cache = new Map<string, { at: number; body: EarthFeed }>();

export async function GET(_req: Request, { params }: { params: Promise<{ feed: string }> }) {
  const { feed } = await params;
  const f = Object.prototype.hasOwnProperty.call(FEEDS, feed) ? FEEDS[feed]! : null;
  if (!f) return NextResponse.json({ error: "unknown feed" }, { status: 404 });
  const maxAge = Math.round(f.ttlMs / 1000);
  const hit = cache.get(feed);
  if (hit && Date.now() - hit.at < f.ttlMs) {
    return NextResponse.json(hit.body, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=3600` } });
  }
  try {
    const res = await fetch(f.url, { headers: { "user-agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(String(res.status));
    const body = f.compact(await res.json());
    cache.set(feed, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=3600` } });
  } catch (err) {
    if (hit) return NextResponse.json(hit.body, { headers: { "Cache-Control": "public, s-maxage=120" } });
    return NextResponse.json({ error: String(err) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
