import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { autoApprove, runChecks } from "../../../../lib/agon/checks";
import { toSheetRow, validateEnrollment } from "../../../../lib/agon/enroll";
import { CERT_BUCKET, certPath, checkCertFiles, MAX_TOTAL_BYTES } from "../../../../lib/agon/files";
import { appendEnrollment, sheetConfigured } from "../../../../lib/agon/sheet";
import { countEnrollments, db, dbConfigured, insertEnrollment } from "../../../../lib/db/server";

export const runtime = "nodejs";
export const maxDuration = 30;

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

type Incoming = { body: Record<string, unknown>; files: { cert: string; file: File }[] };

/** JSON, or multipart with a `payload` JSON field plus one `cert:<id>` file per certification. */
async function readBody(req: Request): Promise<Incoming | null> {
  const type = req.headers.get("content-type") || "";
  try {
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const body = JSON.parse(String(form.get("payload") || "null"));
      const files: Incoming["files"] = [];
      for (const [key, value] of form.entries()) {
        if (key.startsWith("cert:") && typeof value !== "string") files.push({ cert: key.slice(5), file: value });
      }
      return body && typeof body === "object" ? { body, files } : null;
    }
    const body = await req.json();
    return body && typeof body === "object" ? { body, files: [] } : null;
  } catch {
    return null;
  }
}

/** POST /api/agon/enroll — checks run, files are stored, and it lands as `pending` (database, else sheet). */
export async function POST(req: Request) {
  if (!dbConfigured() && !sheetConfigured()) {
    return NextResponse.json({ error: "not-configured" }, { status: 503 });
  }

  const now = Date.now();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip, now)) {
    return NextResponse.json({ error: "slow-down" }, { status: 429 });
  }

  const incoming = await readBody(req);
  if (!incoming) return NextResponse.json({ error: "bad-body" }, { status: 400 });
  const { body } = incoming;

  const result = validateEnrollment(body, now);
  if (!result.ok) {
    // Bots get a quiet success so they don't learn what tripped them.
    if (result.error === "bot") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "invalid", fields: result.fields }, { status: 400 });
  }

  // Every certification claimed needs its file (Paulo 2026-11-11).
  const { ok: files, problems, total } = checkCertFiles(
    incoming.files.map(({ cert, file }) => ({ cert, name: file.name, type: file.type, size: file.size })),
    result.certs,
  );
  const missing = result.certs.filter((c) => !files.some((f) => f.cert === c));
  if (problems.length || missing.length || total > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "files", problems, missing, tooBig: total > MAX_TOTAL_BYTES }, { status: 400 });
  }

  const source = typeof body.source === "string" ? String(body.source).slice(0, 60) : "agon";

  if (!dbConfigured()) {
    // The sheet can't hold files; certificates wait for the database (T310).
    if (files.length) return NextResponse.json({ error: "uploads-off" }, { status: 503 });
    try {
      await appendEnrollment(toSheetRow(result.row), { source });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "sheet-failed" }, { status: 502 });
    }
  }

  const id = randomUUID();
  const stored: { cert: string; path: string; type: string; size: number }[] = [];
  const bucket = db().storage.from(CERT_BUCKET);
  const dropStored = () => (stored.length ? bucket.remove(stored.map((s) => s.path)).catch(() => {}) : undefined);
  for (const f of files) {
    const path = certPath(id, f);
    const blob = incoming.files.find((x) => x.cert === f.cert)!.file;
    const { error } = await bucket.upload(path, blob, { contentType: f.type, upsert: false });
    if (error) {
      await dropStored();
      return NextResponse.json({ error: "upload-failed" }, { status: 502 });
    }
    stored.push({ cert: f.cert, path, type: f.type, size: f.size });
  }

  const checks = await runChecks({
    email: result.row.contact_email,
    phone: result.row.phone,
    link: result.row.link,
    duplicates: await countEnrollments(result.row.contact_email, result.row.kind).catch(() => null),
    claimedCerts: result.certs,
    uploadedCerts: stored.map((s) => s.cert),
  });
  const auto = autoApprove(result.row.kind, checks, result.certs.length);

  try {
    await insertEnrollment(result.row, source, {
      id,
      data: result.data,
      checks,
      files: stored,
      ...(auto
        ? { status: "approved", reviewed_at: new Date().toISOString(), notes: "Auto-approved: every check passed." }
        : {}),
    });
  } catch {
    await dropStored();
    return NextResponse.json({ error: "store-failed" }, { status: 502 });
  }
  if (sheetConfigured()) {
    after(() => appendEnrollment(toSheetRow(result.row), { source }).catch(() => {}));
  }
  return NextResponse.json({ ok: true, approved: auto });
}
