import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnrollRow } from "../agon/enroll";
import { SCREEN_COLUMNS, type TrackRows } from "../telemetry/track";

/**
 * Service-role Supabase access. Server only — the service key bypasses
 * row-level security, so it must never reach the browser. Vaults are not
 * touched here: they hold ciphertext the owner reads/writes directly.
 *
 * Env (Vercel, server): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

let admin: SupabaseClient | null = null;

export function dbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function db(): SupabaseClient {
  if (!dbConfigured()) throw new Error("db-not-configured");
  admin ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export async function insertEnrollment(row: EnrollRow, source: string) {
  const { error } = await db().from("agon_enrollments").insert({ ...row, source });
  if (error) throw new Error(`db-enroll: ${error.code || error.message}`);
}

export async function fetchApprovedFromDb(): Promise<Record<string, unknown>[]> {
  const { data, error } = await db()
    .from("agon_enrollments")
    .select("id, kind, display_name, city, headline, about, link")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`db-directory: ${error.code || error.message}`);
  return data ?? [];
}

const iso = (ms: unknown) => (typeof ms === "number" && ms > 0 ? new Date(ms).toISOString() : null);

export function toUsageRows(rows: TrackRows) {
  const s = rows.session;
  const screens: Record<string, number> = {};
  for (const col of SCREEN_COLUMNS) {
    const v = Number(s[`${col}_s`]) || 0;
    if (v) screens[col] = v;
  }
  const session = {
    session_id: String(s.session_id),
    visitor_id: String(s.visitor_id),
    segment: Number(s.segment) || 1,
    from_tag: String(s.from || ""),
    visit_number: Number(s.visit_number) || 1,
    session_started_at: iso(s.session_started_at),
    segment_started_at: iso(s.segment_started_at),
    segment_ended_at: iso(s.segment_ended_at),
    active_s: Number(s.active_s) || 0,
    taps: Number(s.taps) || 0,
    screens,
    other_s: Number(s.other_s) || 0,
    entry_path: String(s.entry_path || ""),
    exit_path: String(s.exit_path || ""),
    referrer: String(s.referrer || ""),
    device: String(s.device || ""),
    os: String(s.os || ""),
    browser: String(s.browser || ""),
    viewport: String(s.viewport || ""),
    city: String(s.city || ""),
    region: String(s.region || ""),
    country: String(s.country || ""),
    build: String(s.build || ""),
  };
  const events = rows.events.map((e) => ({
    at: iso(e.at),
    session_id: session.session_id,
    visitor_id: session.visitor_id,
    event: e.event,
    screen: e.screen,
    detail: e.detail.replace(/^'/, ""),
  }));
  return { session, events };
}

export async function insertUsage(rows: TrackRows) {
  const { session, events } = toUsageRows(rows);
  const client = db();
  const [a, b] = await Promise.all([
    client.from("usage_sessions").insert(session),
    events.length ? client.from("usage_events").insert(events) : Promise.resolve({ error: null }),
  ]);
  if (a.error || b.error) throw new Error("db-usage");
}
