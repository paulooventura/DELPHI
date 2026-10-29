import { NextResponse } from "next/server";
import { compactOmm, isOrbitGroup, type OrbitSet } from "../../../../lib/orbits";

/**
 * Earth-orbit elements for the orrery, cached so CelesTrak sees at most one request
 * per group every 2 hours per server instance (and the CDN shares one copy).
 * Phones only ever talk to this route, never to CelesTrak.
 */
const TTL_MS = 2 * 60 * 60 * 1000;
const CACHE_HEADER = "public, s-maxage=7200, stale-while-revalidate=86400";
const UA = "PneumaMundi-orrery/1.0 (+https://pauloventura.org)";

const cache = new Map<string, { at: number; body: OrbitSet }>();
const inflight = new Map<string, Promise<OrbitSet>>();

async function fetchJson(url: string, timeoutMs: number): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const j = (await res.json()) as unknown;
  if (!Array.isArray(j) || !j.length) throw new Error(`empty ${url}`);
  return j as Array<Record<string, unknown>>;
}

async function load(group: string): Promise<OrbitSet> {
  const sources = [
    ["CelesTrak", `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`, 8_000],
    ["CelesTrak via satvisor-data mirror", `https://raw.githubusercontent.com/satvisorcom/satvisor-data/master/celestrak/json/${group}.json`, 15_000],
  ] as const;
  let lastErr: unknown = null;
  for (const [source, url, timeoutMs] of sources) {
    try {
      const rows = compactOmm(await fetchJson(url, timeoutMs));
      return { group, source, fetchedAt: new Date().toISOString(), rows };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("orbit sources unavailable");
}

/** `?norad=25544` trims the set to one object (the app's ISS alerts need only that row). */
function only(body: OrbitSet, norad: number): OrbitSet {
  return norad > 0 ? { ...body, rows: body.rows.filter(r => r[0] === norad) } : body;
}

export async function GET(req: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  if (!isOrbitGroup(group)) return NextResponse.json({ error: "unknown group" }, { status: 404 });
  const norad = Math.floor(Number(new URL(req.url).searchParams.get("norad") || 0)) || 0;
  const hit = cache.get(group);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(only(hit.body, norad), { headers: { "Cache-Control": CACHE_HEADER } });
  }
  try {
    let p = inflight.get(group);
    if (!p) {
      p = load(group).finally(() => inflight.delete(group));
      inflight.set(group, p);
    }
    const body = await p;
    cache.set(group, { at: Date.now(), body });
    return NextResponse.json(only(body, norad), { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (err) {
    if (hit) return NextResponse.json(only(hit.body, norad), { headers: { "Cache-Control": "public, s-maxage=600" } });
    return NextResponse.json({ error: String(err) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
