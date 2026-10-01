/**
 * Usage telemetry — validate a beacon from public/pm-telemetry.js and shape it
 * into one session-segment row plus event rows for the sheet.
 * Pure: no network. Anything unexpected is dropped, never echoed.
 */

import { sheetSafe } from "../agon/enroll";

/** Fixed sheet columns (seconds). Anything else lands in `other_s`. */
export const SCREEN_COLUMNS = [
  "splash", "gate", "home", "aether", "heliodrome", "psyche", "cast",
  "atlas", "senses", "oracle", "tools", "about", "agon", "mouseion",
] as const;

const MAX_EVENTS = 200;
const MAX_SEGMENT_S = 6 * 60 * 60;
const ID_RE = /^[a-f0-9]{8,40}$/;
const NAME_RE = /^[a-z0-9_.:#-]{1,40}$/;
const SCREEN_RE = /^[a-z0-9_-]{1,24}$/;

export type Geo = { city: string; region: string; country: string };
export type Device = { device: "mobile" | "tablet" | "desktop"; os: string; browser: string };

export type SessionRow = Record<string, string | number>;
export type EventRow = { at: number; event: string; screen: string; detail: string };
export type TrackRows = { session: SessionRow; events: EventRow[] };

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
}

function int(v: unknown, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function parseDevice(ua: string): Device {
  const u = ua || "";
  const tablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(u);
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(u);
  const os = /iPhone|iPad|iPod/i.test(u) ? "iOS"
    : /Android/i.test(u) ? "Android"
    : /Windows/i.test(u) ? "Windows"
    : /Mac OS X|Macintosh/i.test(u) ? "macOS"
    : /CrOS/i.test(u) ? "ChromeOS"
    : /Linux/i.test(u) ? "Linux" : "other";
  const browser = /Instagram/i.test(u) ? "Instagram in-app"
    : /FBAN|FBAV/i.test(u) ? "Facebook in-app"
    : /TikTok|musical_ly/i.test(u) ? "TikTok in-app"
    : /Edg\//i.test(u) ? "Edge"
    : /OPR\/|Opera/i.test(u) ? "Opera"
    : /Firefox|FxiOS/i.test(u) ? "Firefox"
    : /CriOS|Chrome\//i.test(u) ? "Chrome"
    : /Safari/i.test(u) ? "Safari" : "other";
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", os, browser };
}

/** Referrer reduced to its host — paths can carry personal tokens. */
export function refHost(ref: string): string {
  if (!ref) return "";
  try {
    return new URL(ref).hostname.replace(/^www\./, "").slice(0, 80);
  } catch {
    return "";
  }
}

export function shapeTrack(
  input: unknown,
  ctx: { geo: Geo; ua: string; build: string; now: number },
): TrackRows | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const sid = str(b.sid, 40);
  const vid = str(b.vid, 40);
  if (!ID_RE.test(sid) || !ID_RE.test(vid)) return null;

  const ended = int(b.ended, 0, ctx.now + 60_000);
  const segStart = int(b.segStart, ended - MAX_SEGMENT_S * 1000, ended);
  const started = int(b.started, ended - 7 * 24 * 3600 * 1000, ended);

  const screenSecs: Record<string, number> = {};
  let other = 0;
  let active = 0;
  if (b.screens && typeof b.screens === "object") {
    for (const [k, v] of Object.entries(b.screens as Record<string, unknown>).slice(0, 40)) {
      if (!SCREEN_RE.test(k)) continue;
      const sec = int(v, 0, MAX_SEGMENT_S);
      if (!sec) continue;
      active += sec;
      if ((SCREEN_COLUMNS as readonly string[]).includes(k)) screenSecs[k] = (screenSecs[k] || 0) + sec;
      else other += sec;
    }
  }

  const events: EventRow[] = [];
  if (Array.isArray(b.events)) {
    for (const e of b.events.slice(0, MAX_EVENTS)) {
      if (!e || typeof e !== "object") continue;
      const r = e as Record<string, unknown>;
      const name = str(r.n, 40);
      if (!NAME_RE.test(name)) continue;
      const screen = str(r.s, 24);
      events.push({
        at: int(r.t, segStart - 60_000, ended + 60_000),
        event: name,
        screen: SCREEN_RE.test(screen) ? screen : "",
        detail: sheetSafe(str(r.d, 60).replace(/\d/g, "#")),
      });
    }
  }

  if (!active && !events.length) return null;

  const dev = parseDevice(ctx.ua);
  const session: SessionRow = {
    session_id: sid,
    visitor_id: vid,
    segment: int(b.seg, 1, 10_000),
    from: sheetSafe(str(b.from, 32).toLowerCase().replace(/[^a-z0-9_-]/g, "")),
    visit_number: int(b.visit, 1, 100_000),
    session_started_at: started,
    segment_started_at: segStart,
    segment_ended_at: ended,
    active_s: active,
    taps: int(b.taps, 0, 100_000),
    entry_path: sheetSafe(str(b.entry, 60)),
    exit_path: sheetSafe(str(b.path, 60)),
    referrer: sheetSafe(refHost(str(b.ref, 200))),
    device: dev.device,
    os: dev.os,
    browser: dev.browser,
    viewport: `${int(b.vw, 0, 10000)}x${int(b.vh, 0, 10000)}`,
    city: sheetSafe(ctx.geo.city.slice(0, 60)),
    region: sheetSafe(ctx.geo.region.slice(0, 20)),
    country: sheetSafe(ctx.geo.country.slice(0, 4)),
    build: ctx.build,
    other_s: other,
  };
  for (const col of SCREEN_COLUMNS) session[`${col}_s`] = screenSecs[col] || 0;

  return { session, events };
}
