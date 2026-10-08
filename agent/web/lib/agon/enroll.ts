/**
 * Agon enrollment — pure validation + shaping. No network, no React.
 *
 * Private fields (email, phone, private notes) only ever travel to the
 * Google Sheet. The public directory is built from PUBLIC_FIELDS alone, and
 * only for rows Paulo has marked `approved` in the sheet.
 *
 * Never collect SSN, W-9, tax IDs, or bank details here — payment platforms
 * own that (see the portal's payment / W-9 provider list).
 */

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

export type EnrollResult =
  | { ok: true; row: EnrollRow }
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

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function isEmail(v: string): boolean {
  return v.length <= 254 && EMAIL_RE.test(v);
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

  const display_name = anonymous ? ANONYMOUS_NAME : str(input.display_name, LIMITS.short);
  const contact_email = str(input.contact_email, 254).toLowerCase();
  const phone = str(input.phone, 40);
  const city = str(input.city, LIMITS.short);
  const about = str(input.about, LIMITS.long);
  const rawLink = anonymous ? "" : str(input.link, LIMITS.medium);
  const link = normalizeLink(rawLink);

  if (!display_name) bad.push("display_name");
  if (!isEmail(contact_email)) bad.push("contact_email");
  if (!city && !anonymous) bad.push("city");
  if (rawLink && !link) bad.push("link");
  if (!bool(input.consent)) bad.push("consent");

  let headline = "";
  let details = "";

  if (kind === "venue") {
    const venue_type = oneOf(input.venue_type, VENUE_TYPES);
    const capacity = str(input.capacity, 20);
    const infra = str(input.infrastructure, LIMITS.medium);
    const open_dates = str(input.open_dates, LIMITS.medium);
    if (!capacity) bad.push("capacity");
    headline = [venue_type || "Venue", capacity && `cap ${capacity}`].filter(Boolean).join(" · ");
    details = detailLines([
      ["Venue type", venue_type],
      ["Capacity", capacity],
      ["Infrastructure", infra],
      ["Open dates", open_dates],
    ]);
  } else if (kind === "investor") {
    const sponsor = str(input.sponsor, LIMITS.medium) || str(input.interests, LIMITS.medium);
    const private_name = presence === "person" ? "" : str(input.private_name, LIMITS.short);
    headline = [PRESENCE_LABEL[presence], sponsor].filter(Boolean).join(" · ").slice(0, LIMITS.short);
    details = detailLines([
      ["Appears as", presence],
      ["Wants to sponsor", sponsor],
      ["Private name", private_name],
    ]);
  } else if (kind === "promoter") {
    const event_name = str(input.event_name, LIMITS.short);
    const event_date = str(input.event_date, LIMITS.short);
    const event_venue = str(input.event_venue, LIMITS.short);
    const tier = oneOf(input.tier, TIERS);
    const style = str(input.style, LIMITS.short);
    const cap = str(input.cap, 20);
    const price = str(input.price, 40);
    const backers = str(input.backers, LIMITS.short);
    const crew = str(input.crew, LIMITS.medium);
    headline = ["Promoter", event_name || style].filter(Boolean).join(" · ").slice(0, LIMITS.short);
    details = detailLines([
      ["Event", event_name],
      ["Date", event_date],
      ["Venue", event_venue],
      ["Scale", tier],
      ["Style", style],
      ["Capacity", cap],
      ["Ticket from", price],
      ["Backers", backers],
      ["Crew", crew],
    ]);
  } else if (kind === "role") {
    const dept = str(input.dept, 60);
    const role = str(input.role, LIMITS.short);
    const volunteer = bool(input.volunteer);
    const experience = str(input.experience, LIMITS.long);
    const availability = str(input.availability, LIMITS.medium);
    const certs = Array.isArray(input.certs)
      ? input.certs.map((c) => str(c, 20)).filter(Boolean).slice(0, 12)
      : [];
    if (!role) bad.push("role");
    headline = [volunteer ? "Volunteer" : null, role].filter(Boolean).join(" · ");
    details = detailLines([
      ["Department", dept],
      ["Role", role],
      ["Volunteer / work-exchange", volunteer ? "yes" : ""],
      ["Certifications", certs.join(", ")],
      ["Availability", availability],
      ["Experience", experience],
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
