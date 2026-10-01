import { NextResponse } from "next/server";
import { adminFromRequest } from "../../../../lib/db/auth";
import { db } from "../../../../lib/db/server";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const STATUSES = ["pending", "approved", "rejected"] as const;

/** GET /api/admin/enrollments?status=pending — full rows, admin only. */
export async function GET(req: Request) {
  if (!(await adminFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status") || "pending";
  let q = db().from("agon_enrollments").select("*").order("created_at", { ascending: false }).limit(300);
  if ((STATUSES as readonly string[]).includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "read-failed" }, { status: 502 });
  return NextResponse.json({ entries: data ?? [] }, { headers: NO_STORE });
}

/** PATCH /api/admin/enrollments  { id, status?, notes? } */
export async function PATCH(req: Request) {
  if (!(await adminFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown; notes?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id) return NextResponse.json({ error: "bad-id" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof body?.status === "string" && (STATUSES as readonly string[]).includes(body.status)) {
    patch.status = body.status;
    patch.reviewed_at = new Date().toISOString();
  }
  if (typeof body?.notes === "string") patch.notes = body.notes.slice(0, 2000);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing-to-change" }, { status: 400 });
  const { error } = await db().from("agon_enrollments").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "write-failed" }, { status: 502 });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
