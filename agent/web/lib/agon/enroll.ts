/**
 * Agon enrollment — pure validation + shaping. No network, no React.
 *
 * Private fields (email, phone, private notes, certificate files) stay in the
 * platform's store (Supabase; the Google Sheet is an optional mirror). The
 * public directory is built from PUBLIC_FIELDS alone, and only for approved rows.
 *
 * Never collect SSN, W-9, tax IDs, or bank details here — payment platforms
 * own that (see the portal's payment / W-9 provider list).
 */

import { CERT_LABEL, GEAR_LABEL, isSlotKey, NOTICE_LABEL, RADIUS_LABEL, slotsLine, VISION_LABEL } from "./catalog";

export const ENROLL_KINDS = ["venue", "investor", "promoter", "role"] as const;
export type EnrollKind = (typeof ENROLL_KINDS)[number];

/** How a backer appears publicly. Money is never asked — only presence and intent. */
export const BACKER_PRESENCE = ["person", "alias", "philanthropist", "anonymous"] as const;
export type BackerPresence = (typeof BACKER_PRESENCE)[number];
const PRESENCE_LABEL: Record<BackerPresence, string> = {
  person: "Backer",
  alias: "Backer",
  philanthropist: "Philanthropist",
  anonymous: "Anonymous backer",
};
export const ANONYMOUS_NAME = "Anonymous backer";
export const VENUE_TYPES = ["Bar / lounge", "Club", "Warehouse / loft", "Concert hall", "Outdoor site", "Gallery / studio", "Other"] as const;
export const TIERS = ["Bar ≤150", "Club night", "Concert", "Festival 5k+"] as const;

/** Fields safe to show in the public Agon directory. */
export const PUBLIC_FIELDS = ["id", "kind", "display_name", "city", "headline", "about", "link"] as const;
export type PublicEntry = Record<(typeof PUBLIC_FIELDS)[number], string>;

/** Minimum time a human plausibly needs to fill the form. */
export const MIN_FILL_MS = 3000;

const LIMITS = {
  short: 120,
  medium: 240,
  long: 800,
} as const;

export type EnrollRow = {
  kind: EnrollKind;
  display_name: string;
  contact_email: string;
  phone: string;
  city: string;
  link: string;
  about: string;
  headline: string;
  /** Kind-specific details, flattened to "key: value" lines for the sheet. */
  details: string;
};

/** Structured answers (departments, roles, gear, availability...) kept as JSON for matching later. */
export type EnrollData = Record<string, unknown>;

export type EnrollResult =
  /** `certs`: certification ids claimed; each one needs an uploaded file. */
  | { ok: true; row: EnrollRow; data: EnrollData; certs: string[] }
  | { ok: false; error: "bot" | "invalid"; fields?: string[] };

type Input = Record<string, unknown>;

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1";
}

function oneOf<T extends readonly string[]>(v: unknown, list: T): T[number] | "" {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : "";
}

/** A list of short strings from the form; with an allow-list, unknown ids are dropped. */
function list(v: unknown, max: number, allow?: Map<string, string> | ((s: string) => boolean)): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
  const out: string[] = [];
  for (const x of arr) {
    const s = str(x, 80);
    if (!s || out.includes(s)) continue;
    if (allow instanceof Map ? !allow.has(s) : allow ? !allow(s) : false) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const labels = (ids: string[], m: Map<string, string>) => ids.map((i) => m.get(i) || i);

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function isEmail(v: string): boolean {
  return v.length <= 254 && EMAIL_RE.test(v);
}

/** 7 to 15 digits once spaces, dashes, dots, brackets and a leading + are dropped. */
export function isPhone(v: string): boolean {
  const digits = v.replace(/[\s().-]/g, "").replace(/^\+/, "");
  return /^\d{7,15}$/.test(digits);
}

/** Accepts bare domains and @handles; returns "" for anything non-http. */
export function normalizeLink(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^@[\w.]{1,40}$/.test(v)) return `https://instagram.com/${v.slice(1)}`;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (!u.hostname.includes(".")) return "";
    return u.toString().slice(0, LIMITS.medium);
  } catch {
    return "";
  }
}

/** Google Sheets executes cells starting with these as formulas. */
export function sheetSafe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function detailLines(pairs: [string, string][]): string {
  return pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function validateEnrollment(input: Input, now = Date.now()): EnrollResult {
  if (str(input.website, 200)) return { ok: false, error: "bot" };
  const startedAt = Number(input.started_at);
  if (!Number.isFinite(startedAt) || now - startedAt < MIN_FILL_MS) {
    return { ok: false, error: "bot" };
  }

  const bad: string[] = [];
  const kind = oneOf(input.kind, ENROLL_KINDS);
  if (!kind) bad.push("kind");

  const presence: BackerPresence =
    kind === "investor" ? oneOf(input.presence, BACKER_PRESENCE) || "person" : "person";
  const anonymous = presence === "anonymous";

  // Anonymous backers still give a name we can call them (it can be invented); it never goes public.
  const given_name = str(input.display_name, LIMITS.short);
  const display_name = anonymous ? ANONYMOUS_NAME : given_name;
  const contact_email = str(input.contact_email, 254).toLowerCase();
  const phone = str(input.phone, 40);
  const city = str(input.city, LIMITS.short);
  // "Experience" folded into About (Paulo 2026-11-11); older forms may still send it.
  const about = [str(input.about, LIMITS.long), str(input.experience, LIMITS.long)]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, LIMITS.long);
  const rawLink = anonymous ? "" : str(input.link, LIMITS.medium);
  const link = normalizeLink(rawLink);
  const private_name = anonymous
    ? str(input.private_name, LIMITS.short) || given_name
    : presence === "person"
      ? ""
      : str(input.private_name, LIMITS.short);

  if (!given_name) bad.push("display_name");
  if (!isEmail(contact_email)) bad.push("contact_email");
  if (!isPhone(phone)) bad.push("phone");
  if (!city && !anonymous) bad.push("city");
  if (rawLink && !link) bad.push("link");
  if (!bool(input.consent)) bad.push("consent");

  let headline = "";
  let details = "";
  let data: EnrollData = {};
  let certs: string[] = [];

  if (kind === "venue") {
    const venue_type = oneOf(input.venue_type, VENUE_TYPES);
    const capacity = str(input.capacity, 20);
    const gear = list(input.gear, 80, GEAR_LABEL);
    const gear_other = str(input.gear_other, LIMITS.medium) || str(input.infrastructure, LIMITS.medium);
    const open_dates = str(input.open_dates, LIMITS.medium);
    if (!capacity) bad.push("capacity");
    headline = [venue_type || "Venue", capacity && `cap ${capacity}`].filter(Boolean).join(" · ");
    data = { venue_type, capacity, gear, gear_other, open_dates };
    details = detailLines([
      ["Venue type", venue_type],
      ["Capacity", capacity],
      ["Has", labels(gear, GEAR_LABEL).join(", ")],
      ["Also", gear_other],
      ["Open dates", open_dates],
    ]);
  } else if (kind === "investor") {
    const vision = list(input.vision, 12, VISION_LABEL);
    const vision_text =
      str(input.vision_text, LIMITS.medium) || str(input.sponsor, LIMITS.medium) || str(input.interests, LIMITS.medium);
    const visionLine = labels(vision, VISION_LABEL).join(", ");
    headline = [PRESENCE_LABEL[presence], visionLine || vision_text].filter(Boolean).join(" · ").slice(0, LIMITS.short);
    data = { presence, vision, vision_text };
    details = detailLines([
      ["Appears as", presence],
      ["Vision", visionLine],
      ["In their words", vision_text],
      ["Private name", private_name],
    ]);
  } else if (kind === "promoter") {
    // The form asks only for the company now; the Create-an-event wizard can still pass its night along.
    const pairs: [string, string][] = [
      ["Event", str(input.event_name, LIMITS.short)],
      ["Date", str(input.event_date, LIMITS.short)],
      ["Venue", str(input.event_venue, LIMITS.short)],
      ["Scale", oneOf(input.tier, TIERS)],
      ["Style", str(input.style, LIMITS.short)],
      ["Capacity", str(input.cap, 20)],
      ["Ticket from", str(input.price, 40)],
      ["Backers", str(input.backers, LIMITS.short)],
      ["Crew", str(input.crew, LIMITS.medium)],
    ];
    headline = ["Promoter", pairs[0][1] || pairs[4][1]].filter(Boolean).join(" · ").slice(0, LIMITS.short);
    data = Object.fromEntries(pairs.filter(([, v]) => v).map(([k, v]) => [k.toLowerCase().replace(/ /g, "_"), v]));
    details = detailLines(pairs);
  } else if (kind === "role") {
    const depts = list(input.depts ?? input.dept, 12);
    const roles = list(input.roles ?? input.role, 16);
    const volunteer = bool(input.volunteer);
    certs = list(input.certs, 20, CERT_LABEL);
    const cert_other = certs.includes("other") ? str(input.cert_other, LIMITS.short) : "";
    if (certs.includes("other") && !cert_other) bad.push("cert_other");
    const slots = list(input.slots, 21, isSlotKey);
    const noticeIn = str(input.notice, 20);
    const radiusIn = str(input.radius, 20);
    const notice = NOTICE_LABEL.has(noticeIn) ? noticeIn : "";
    const radius = RADIUS_LABEL.has(radiusIn) ? radiusIn : "";
    const blackout = str(input.blackout, LIMITS.medium);
    const legacyAvailability = str(input.availability, LIMITS.medium);
    if (!roles.length) bad.push("role");
    const roleLine = roles.slice(0, 3).join(", ") + (roles.length > 3 ? ` +${roles.length - 3}` : "");
    headline = [volunteer ? "Volunteer" : null, roleLine].filter(Boolean).join(" · ").slice(0, LIMITS.short);
    data = { depts, roles, volunteer, certs, cert_other, slots, notice, radius, blackout };
    const certLine = certs.map((c) => (c === "other" ? cert_other : CERT_LABEL.get(c) || c)).join(", ");
    details = detailLines([
      ["Departments", depts.join(", ")],
      ["Roles", roles.join(", ")],
      ["Volunteer / work-exchange", volunteer ? "yes" : ""],
      ["Certifications", certLine],
      ["Available", slotsLine(slots) || legacyAvailability],
      ["Notice needed", NOTICE_LABEL.get(notice) || ""],
      ["Travel", RADIUS_LABEL.get(radius) || ""],
      ["Can't do", blackout],
    ]);
  }

  if (bad.length) return { ok: false, error: "invalid", fields: bad };

  return {
    ok: true,
    row: {
      kind: kind as EnrollKind,
      display_name,
      contact_email,
      phone,
      city,
      link,
      about,
      headline,
      details,
    },
    data,
    certs,
  };
}

/** Escapes every string cell so the sheet never evaluates user input. */
export function toSheetRow(row: EnrollRow): EnrollRow {
  const out = { ...row };
  for (const k of Object.keys(out) as (keyof EnrollRow)[]) {
    (out as Record<string, string>)[k] = sheetSafe(String(out[k]));
  }
  return out;
}

/** Strips anything the sheet returns down to public-safe fields. */
export function toPublicEntry(raw: unknown): PublicEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = oneOf(r.kind, ENROLL_KINDS);
  const display_name = str(r.display_name, LIMITS.short).replace(/^'/, "");
  if (!kind || !display_name) return null;
  const clean = (v: unknown, max: number) => str(v, max).replace(/^'/, "");
  return {
    id: clean(r.id, 40),
    kind,
    display_name,
    city: clean(r.city, LIMITS.short),
    headline: clean(r.headline, LIMITS.short),
    about: clean(r.about, LIMITS.long),
    link: normalizeLink(clean(r.link, LIMITS.medium)),
  };
}
