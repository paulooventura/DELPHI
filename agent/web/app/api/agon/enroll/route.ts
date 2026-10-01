import { after, NextResponse } from "next/server";
import { toSheetRow, validateEnrollment } from "../../../../lib/agon/enroll";
import { appendEnrollment, sheetConfigured } from "../../../../lib/agon/sheet";
import { dbConfigured, insertEnrollment } from "../../../../lib/db/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
// Best effort per warm instance; the honeypot + fill timer do the heavy lifting.
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

/** POST /api/agon/enroll — lands as a `pending` enrollment (database, else sheet). */
export async function POST(req: Request) {
  if (!dbConfigured() && !sheetConfigured()) {
    return NextResponse.json({ error: "not-configured" }, { status: 503 });
  }

  const now = Date.now();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip, now)) {
    return NextResponse.json({ error: "slow-down" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const result = validateEnrollment(body as Record<string, unknown>, now);
  if (!result.ok) {
    // Bots get a quiet success so they don't learn what tripped them.
    if (result.error === "bot") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "invalid", fields: result.fields }, { status: 400 });
  }

  const source = typeof (body as Record<string, unknown>).source === "string"
    ? String((body as Record<string, unknown>).source).slice(0, 60)
    : "agon";

  // Database is the record when configured; the sheet is a best-effort mirror.
  if (dbConfigured()) {
    try {
      await insertEnrollment(result.row, source);
    } catch {
      return NextResponse.json({ error: "store-failed" }, { status: 502 });
    }
    if (sheetConfigured()) {
      after(() => appendEnrollment(toSheetRow(result.row), { source }).catch(() => {}));
    }
    return NextResponse.json({ ok: true });
  }

  try {
    await appendEnrollment(toSheetRow(result.row), { source });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "sheet-failed" }, { status: 502 });
  }
}
