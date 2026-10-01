import { NextResponse } from "next/server";
import { adminFromRequest } from "../../../../lib/db/auth";
import { db } from "../../../../lib/db/server";
import { summarizeUsage, type UsageEvent, type UsageSession } from "../../../../lib/telemetry/summary";

export const runtime = "nodejs";
export const maxDuration = 30;

const PAGE = 1000;
const MAX_ROWS = 30_000;

async function fetchSince<T>(table: string, cols: string, since: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db()
      .from(table)
      .select(cols)
      .gte("received_at", since)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(table);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** GET /api/admin/usage?days=30 — aggregated beta usage, admin only. */
export async function GET(req: Request) {
  if (!(await adminFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  try {
    const [sessions, events] = await Promise.all([
      fetchSince<UsageSession>(
        "usage_sessions",
        "session_id, visitor_id, visit_number, active_s, taps, screens, other_s, from_tag, referrer, device, os, browser, city, country",
        since,
      ),
      fetchSince<UsageEvent>("usage_events", "at, received_at, event, screen, detail", since),
    ]);
    return NextResponse.json({ days, summary: summarizeUsage(sessions, events) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "read-failed" }, { status: 502 });
  }
}
