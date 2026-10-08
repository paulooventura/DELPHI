import { describe, expect, it } from "vitest";
import {
  MIN_FILL_MS,
  normalizeLink,
  sheetSafe,
  toPublicEntry,
  toSheetRow,
  validateEnrollment,
} from "./enroll";

const NOW = 1_800_000_000_000;
const base = {
  started_at: NOW - 60_000,
  display_name: "The Annex",
  contact_email: "Hello@Annex.example",
  city: "Nashville, TN",
  consent: true,
};

describe("validateEnrollment", () => {
  it("accepts a venue and builds a headline", () => {
    const r = validateEnrollment({ ...base, kind: "venue", venue_type: "Club", capacity: "300" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.headline).toBe("Club · cap 300");
    expect(r.row.contact_email).toBe("hello@annex.example");
    expect(r.row.details).toContain("Capacity: 300");
  });

  it("requires capacity for venues", () => {
    const v = validateEnrollment({ ...base, kind: "venue" }, NOW);
    expect(v).toEqual({ ok: false, error: "invalid", fields: ["capacity"] });
  });

  it("backers never need a money answer", () => {
    const r = validateEnrollment({ ...base, kind: "investor", display_name: "Ana Reyes", sponsor: "Warehouse nights" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.headline).toBe("Backer · Warehouse nights");
    expect(r.row.details).toContain("Appears as: person");
    expect(r.row.details).not.toMatch(/check|\$/i);
  });

  it("anonymous backers stay anonymous in every public field", () => {
    const r = validateEnrollment(
      {
        ...base, kind: "investor", presence: "anonymous", display_name: "Real Name", city: "",
        link: "realname.example", private_name: "Real Name", sponsor: "Youth music programs",
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.display_name).toBe("Anonymous backer");
    expect(r.row.link).toBe("");
    expect(r.row.headline).toBe("Anonymous backer · Youth music programs");
    expect(r.row.details).toContain("Private name: Real Name");
    const pub = toPublicEntry({ id: "b1", ...r.row });
    expect(JSON.stringify(pub)).not.toContain("Real Name");
  });

  it("aliases and philanthropists appear under the name they choose", () => {
    const a = validateEnrollment({ ...base, kind: "investor", presence: "alias", display_name: "Night Owl", private_name: "Sam Lee" }, NOW);
    expect(a.ok && a.row.display_name).toBe("Night Owl");
    expect(a.ok && a.row.headline).toBe("Backer");
    const p = validateEnrollment({ ...base, kind: "investor", presence: "philanthropist", display_name: "Reyes Foundation" }, NOW);
    expect(p.ok && p.row.headline).toBe("Philanthropist");
  });

  it("flags volunteer roles and keeps certs", () => {
    const r = validateEnrollment(
      { ...base, kind: "role", role: "FOH Engineer", dept: "Audio", volunteer: true, certs: ["RF", "ELEC"] },
      NOW,
    );
    expect(r.ok && r.row.headline).toBe("Volunteer · FOH Engineer");
    expect(r.ok && r.row.details).toContain("Certifications: RF, ELEC");
  });

  it("rejects missing consent, bad email, and bad kind", () => {
    const r = validateEnrollment({ ...base, kind: "dj", consent: false, contact_email: "nope" }, NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fields).toEqual(expect.arrayContaining(["kind", "consent", "contact_email"]));
  });

  it("treats honeypot and too-fast fills as bots", () => {
    expect(validateEnrollment({ ...base, kind: "investor", website: "x" }, NOW))
      .toEqual({ ok: false, error: "bot" });
    expect(validateEnrollment({ ...base, kind: "investor", started_at: NOW - MIN_FILL_MS + 1 }, NOW))
      .toEqual({ ok: false, error: "bot" });
  });

  it("carries promoter wizard fields into details", () => {
    const r = validateEnrollment(
      { ...base, kind: "promoter", event_name: "Coupled", tier: "Club night", price: "$20", crew: "Audio, Lighting & Electrical" },
      NOW,
    );
    expect(r.ok && r.row.headline).toBe("Promoter · Coupled");
    expect(r.ok && r.row.details).toContain("Scale: Club night");
    expect(r.ok && r.row.details).toContain("Crew: Audio, Lighting & Electrical");
  });
});

describe("sheet + public shaping", () => {
  it("neutralizes formula injection", () => {
    expect(sheetSafe("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(sheetSafe("+1 615")).toBe("'+1 615");
    expect(sheetSafe("plain")).toBe("plain");
    const r = validateEnrollment({ ...base, kind: "venue", capacity: "300", display_name: "=cmd()" }, NOW);
    expect(r.ok && toSheetRow(r.row).display_name).toBe("'=cmd()");
  });

  it("normalizes links and refuses non-http schemes", () => {
    expect(normalizeLink("@annex.nash")).toBe("https://instagram.com/annex.nash");
    expect(normalizeLink("annex.example")).toBe("https://annex.example/");
    expect(normalizeLink("javascript:alert(1)")).toBe("");
    expect(normalizeLink("localhost")).toBe("");
  });

  it("public entries never carry private fields", () => {
    const e = toPublicEntry({
      id: "a1", kind: "venue", display_name: "'=The Annex", city: "Nashville", headline: "Club",
      about: "hi", link: "annex.example", contact_email: "x@y.z", phone: "555", details: "secret", notes: "n",
    });
    expect(e).toEqual({
      id: "a1", kind: "venue", display_name: "=The Annex", city: "Nashville", headline: "Club",
      about: "hi", link: "https://annex.example/",
    });
    expect(toPublicEntry({ kind: "bogus", display_name: "x" })).toBeNull();
  });
});
