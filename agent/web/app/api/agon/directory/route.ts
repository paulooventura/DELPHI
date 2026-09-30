import { NextResponse } from "next/server";
import { toPublicEntry, type PublicEntry } from "../../../../lib/agon/enroll";
import { fetchApproved, sheetConfigured } from "../../../../lib/agon/sheet";

export const runtime = "nodejs";
export const maxDuration = 20;

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; entries: PublicEntry[] } | null = null;

/** GET /api/agon/directory — approved rows only, public fields only. */
export async function GET() {
  if (!sheetConfigured()) {
    return NextResponse.json({ configured: false, entries: [] });
  }

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ configured: true, entries: cache.entries }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  try {
    const raw = await fetchApproved();
    const entries = raw.map(toPublicEntry).filter((e): e is PublicEntry => e !== null).slice(0, 500);
    cache = { at: now, entries };
    return NextResponse.json({ configured: true, entries }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ configured: true, entries: cache?.entries || [], error: "sheet-failed" }, {
      status: cache ? 200 : 502,
    });
  }
}
