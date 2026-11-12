import { NextResponse } from "next/server";
import { compactOmm, isOrbitGroup, medianEpochIso, mergeFreshRows, type OrbitSet } from "../../../../lib/orbits";
import { ORBIT_APPROX_DAYS, ORBIT_HIDE_DAYS } from "../../../../lib/orbitAge";

/** Fetching the mirror's groups to rebuild "active" can take a while on a cold start. */
export const maxDuration = 60;

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

const MIRROR = "https://raw.githubusercontent.com/satvisorcom/satvisor-data/master/celestrak/json";

/**
 * The mirror's groups that make up CelesTrak's "active" set. Its own active.json (and starlink.json) went stale in
 * Oct 2026 while these kept updating, so when CelesTrak is down "active" is rebuilt from them (T473).
 */
const ACTIVE_PARTS = [
  "last-30-days", "stations", "visual", "weather", "goes", "resource", "sarsat", "dmc", "tdrss", "argos",
  "planet", "spire", "geo", "intelsat", "ses", "eutelsat", "iridium-NEXT", "starlink", "oneweb", "kuiper", "qianfan",
  "hulianwang", "orbcomm", "globalstar", "amateur", "x-comm", "other-comm", "satnogs",
  "gnss", "gps-ops", "glo-ops", "galileo", "beidou", "sbas", "nnss", "musson", "science", "geodetic", "engineering",
  "education", "military", "radar", "cubesat",
];

/** Mirror data is stamped with its real age (median element epoch), never the day we happened to fetch it. */
function mirrorSet(group: string, source: string, rows: OrbitSet["rows"]): OrbitSet {
  return { group, source, fetchedAt: medianEpochIso(rows) ?? new Date().toISOString(), rows };
}

const fresh = (rows: OrbitSet["rows"]) => {
  const at = medianEpochIso(rows);
  return !!at && Date.now() - Date.parse(at) <= ORBIT_APPROX_DAYS * 86_400_000;
};

async function load(group: string): Promise<OrbitSet> {
  let lastErr: unknown = null;
  try {
    const rows = compactOmm(await fetchJson(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`, 8_000));
    return { group, source: "CelesTrak", fetchedAt: new Date().toISOString(), rows };
  } catch (err) {
    lastErr = err;
  }
  let stale: OrbitSet | null = null;
  try {
    const rows = compactOmm(await fetchJson(`${MIRROR}/${group}.json`, 15_000));
    const set = mirrorSet(group, "CelesTrak via satvisor-data mirror", rows);
    if (fresh(rows)) return set;
    stale = set;
  } catch (err) {
    lastErr = err;
  }
  if (group === "active") {
    const parts = await Promise.allSettled(ACTIVE_PARTS.map(g => fetchJson(`${MIRROR}/${g}.json`, 15_000)));
    const sets = parts.flatMap(p => (p.status === "fulfilled" ? [compactOmm(p.value)] : []));
    if (stale) sets.push(stale.rows);
    const rows = mergeFreshRows(sets, Date.now(), ORBIT_HIDE_DAYS);
    if (rows.length) return mirrorSet(group, "CelesTrak groups via satvisor-data mirror", rows);
  }
  if (stale) {
    // Old but not useless: keep only the objects still inside the 14-day window.
    const rows = mergeFreshRows([stale.rows], Date.now(), ORBIT_HIDE_DAYS);
    if (rows.length) return mirrorSet(group, stale.source, rows);
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
