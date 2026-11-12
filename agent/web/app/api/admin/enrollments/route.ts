import { NextResponse } from "next/server";
import { adminFromRequest } from "../../../../lib/db/auth";
import { CERT_BUCKET } from "../../../../lib/agon/files";
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
  const entries = (data ?? []) as { files?: { cert: string; path: string }[] }[];
  // Certificate files open through signed links that expire in 10 minutes; the bucket itself stays private.
  const paths = entries.flatMap((e) => (Array.isArray(e.files) ? e.files.map((f) => f.path) : []));
  if (paths.length) {
    const { data: signed } = await db().storage.from(CERT_BUCKET).createSignedUrls(paths, 600);
    const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const e of entries) {
      if (Array.isArray(e.files)) e.files = e.files.map((f) => ({ ...f, url: url.get(f.path) || null }));
    }
  }
  return NextResponse.json({ entries }, { headers: NO_STORE });
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
