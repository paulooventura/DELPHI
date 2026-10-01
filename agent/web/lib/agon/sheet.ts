import type { EnrollRow } from "./enroll";
import type { TrackRows } from "../telemetry/track";

/**
 * Talks to the Pneuma Mundi Apps Script web app (Agon enrollments + usage
 * telemetry share one sheet). Both env vars are server-only and set in
 * Vercel: AGON_SHEET_WEBHOOK_URL (the /exec URL) and AGON_SHEET_SECRET
 * (must equal the script property AGON_SECRET).
 */

export function sheetConfigured(): boolean {
  return Boolean(process.env.AGON_SHEET_WEBHOOK_URL && process.env.AGON_SHEET_SECRET);
}

async function call(action: "enroll" | "directory" | "track", payload: Record<string, unknown> = {}) {
  const url = process.env.AGON_SHEET_WEBHOOK_URL;
  const secret = process.env.AGON_SHEET_SECRET;
  if (!url || !secret) throw new Error("not-configured");

  // Apps Script answers POST with a 302 to a googleusercontent URL; fetch follows it.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, secret, ...payload }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`sheet-http-${res.status}`);
  const data = (await res.json()) as { ok?: boolean; error?: string; entries?: unknown[] };
  if (!data.ok) throw new Error(data.error || "sheet-error");
  return data;
}

export async function appendEnrollment(row: EnrollRow, meta: { source: string }) {
  return call("enroll", { row, meta });
}

export async function appendTelemetry(rows: TrackRows) {
  return call("track", rows);
}

export async function fetchApproved(): Promise<unknown[]> {
  const data = await call("directory");
  return Array.isArray(data.entries) ? data.entries : [];
}
