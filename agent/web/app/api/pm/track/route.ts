import { DELPHI_BUILD } from "../../../../lib/buildStamp";
import { appendTelemetry, sheetConfigured } from "../../../../lib/agon/sheet";
import { shapeTrack } from "../../../../lib/telemetry/track";
import { dbConfigured, insertUsage } from "../../../../lib/db/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_BODY = 64 * 1024;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function limited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function header(req: Request, name: string): string {
  const v = req.headers.get(name) || "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

const done = () => new Response(null, { status: 204 });

/** POST /api/pm/track — beacon sink. Always 204; never tells the client why. */
export async function POST(req: Request) {
  if (!dbConfigured() && !sheetConfigured()) return done();

  const now = Date.now();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip, now)) return done();

  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return done();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done();
  }

  const rows = shapeTrack(body, {
    now,
    ua: req.headers.get("user-agent") || "",
    build: DELPHI_BUILD,
    geo: {
      city: header(req, "x-vercel-ip-city"),
      region: header(req, "x-vercel-ip-country-region"),
      country: header(req, "x-vercel-ip-country"),
    },
  });
  if (!rows) return done();

  // Telemetry is best effort on both sinks.
  await Promise.allSettled([
    dbConfigured() ? insertUsage(rows) : Promise.resolve(),
    sheetConfigured() ? appendTelemetry(rows) : Promise.resolve(),
  ]);
  return done();
}
