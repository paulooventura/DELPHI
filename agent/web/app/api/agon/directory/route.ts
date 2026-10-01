import { NextResponse } from "next/server";
import { toPublicEntry, type PublicEntry } from "../../../../lib/agon/enroll";
import { fetchApproved, sheetConfigured } from "../../../../lib/agon/sheet";
import { dbConfigured, fetchApprovedFromDb } from "../../../../lib/db/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; entries: PublicEntry[] } | null = null;

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

/** GET /api/agon/directory — approved entries only, public fields only. */
export async function GET() {
  const useDb = dbConfigured();
  if (!useDb && !sheetConfigured()) {
    return NextResponse.json({ configured: false, entries: [] });
  }

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ configured: true, entries: cache.entries }, { headers: CACHE_HEADERS });
  }

  try {
    const raw = useDb ? await fetchApprovedFromDb() : await fetchApproved();
    const entries = raw.map(toPublicEntry).filter((e): e is PublicEntry => e !== null).slice(0, 500);
    cache = { at: now, entries };
    return NextResponse.json({ configured: true, entries }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ configured: true, entries: cache?.entries || [], error: "store-failed" }, {
      status: cache ? 200 : 502,
    });
  }
}
