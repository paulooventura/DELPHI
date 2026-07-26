/**
 * GEO-HERITAGE — land-first foregrounding.
 * ----------------------------------------------------------------------------
 * Delphi grounds you in time and space. The compass orients you to HERE; the
 * sky map to what's above here; this layer to how the PEOPLE of here have read
 * this sky. Land first — the ground teaches you something you didn't carry in.
 *
 * This does NOT change what's computed. The sky is the sky everywhere; the
 * moment-chord is still composed from every `computed` system. What place
 * changes is EMPHASIS — which voices lead, and which land is acknowledged.
 *
 * THREE HONESTY TIERS (from each entry's `honesty` field):
 *   render      → show the tradition fully (public, textual: Hellenistic, Vedic…)
 *   foreground  → lead by place, show the CALENDAR, never fabricate personality
 *                 (Cherokee thirteen moons — a calendar of place, honestly)
 *   acknowledge → name the people + point outward; never encode sacred content
 *                 (Aboriginal, and other living/sacred sky-knowledge)
 *
 * The boundary is the respect: where a tradition is sacred or living, the app
 * foregrounds what's public and points to the people to speak for themselves.
 */

import { QUALIA, type QualiaEntry } from "./qualia";

/** A region tag as used in each entry's `origin`. */
export type Region =
  | "global" | "mediterranean" | "babylon" | "greece" | "egypt" | "nile"
  | "india" | "china" | "east-asia" | "mesoamerica" | "west-africa" | "yorubaland"
  | "scandinavia" | "germanic" | "europe" | "modern"
  | "southeast-woodlands" | "cherokee";

/**
 * A land record: which people's traditions arose on a coordinate box, and how
 * the app is permitted to present them. Land acknowledgment is first-class.
 *
 * This is a STARTER set — deliberately small and honest. Expand it with real
 * sources per region; never guess a people's land from a rough box in
 * production without checking against an authority (e.g. Native Land Digital
 * for Indigenous territories). The acknowledgment text should be verified with
 * the nation's own cultural office wherever possible.
 */
export type LandRecord = {
  id: string;
  label: string;                 // human-readable place
  bbox: [number, number, number, number]; // [minLat, minLon, maxLat, maxLon]
  regions: Region[];             // heritage traditions of this land, in lead order
  acknowledge?: {
    people: string;              // e.g. "the ᏣᎳᎩ (Cherokee)"
    text: string;                // the land acknowledgment line
    pointTo: string;             // a URL to the people's own resources
  };
};

/**
 * Starter land records. LAND-FIRST: `regions` are ordered so the land's own
 * traditions lead the reading. Coarse boxes are a starting point, not truth —
 * production should resolve Indigenous territory against a real dataset.
 */
export const LANDS: LandRecord[] = [
  {
    id: "us-southeast",
    label: "US Southeast (Cherokee ancestral land)",
    bbox: [33.0, -90.0, 37.5, -81.0], // rough; Nashville sits inside
    regions: ["cherokee", "southeast-woodlands"],
    // TODO(verify): confirm territory + acknowledgment with Cherokee Nation cultural office; resolve bbox against Native Land Digital before production.
    acknowledge: {
      people: "the ᏣᎳᎩ (Cherokee)",
      text: "You stand on the ancestral land of the ᏣᎳᎩ (Cherokee). Their thirteen-moon calendar is one of this land's own ways of keeping time.",
      pointTo: "https://www.cherokee.org/",
    },
  },
  {
    id: "mesoamerica",
    label: "Mesoamerica",
    bbox: [14.0, -105.0, 22.0, -86.0],
    regions: ["mesoamerica"],
    // TODO(verify): confirm with Maya descendant cultural offices; refine bbox via Native Land Digital.
    acknowledge: {
      people: "the Maya and their descendants",
      text: "You stand on Maya land. The Tzolk'in — the oldest continuously used calendar in the Americas — was born here.",
      pointTo: "https://www.mayasforancientmayan.org/",
    },
  },
  {
    id: "nile",
    label: "The Nile / Egypt",
    bbox: [22.0, 25.0, 31.5, 35.0],
    regions: ["egypt", "nile", "mediterranean"],
  },
  {
    id: "india",
    label: "Indian subcontinent",
    bbox: [8.0, 68.0, 35.0, 89.0],
    regions: ["india"],
  },
  {
    id: "china",
    label: "China / East Asia",
    bbox: [20.0, 100.0, 45.0, 124.0],
    regions: ["china", "east-asia"],
  },
  {
    id: "greece-med",
    label: "Greece / Eastern Mediterranean",
    bbox: [34.0, 19.0, 42.0, 29.0], // includes Cyprus, the Aegean
    regions: ["greece", "mediterranean", "babylon"],
  },
  {
    id: "west-africa",
    label: "West Africa / Yorubaland",
    bbox: [4.0, 2.0, 14.0, 15.0],
    regions: ["yorubaland", "west-africa"],
    // TODO(verify): refine with Yoruba cultural authorities; Ifá framing stays acknowledge-only for sacred content.
    acknowledge: {
      people: "the Yoruba",
      text: "You stand on Yoruba land. Ifá — a vast body of wisdom and divination — is held here by initiated babalawos.",
      pointTo: "https://en.wikipedia.org/wiki/If%C3%A1",
    },
  },
  {
    id: "scandinavia",
    label: "Scandinavia / Northern Europe",
    bbox: [55.0, 4.0, 71.0, 31.0],
    regions: ["scandinavia", "germanic"],
  },
  {
    id: "australia",
    label: "Australia",
    bbox: [-44.0, 112.0, -10.0, 154.0],
    // Aboriginal sky-knowledge is the oldest continuous astronomy on Earth, but
    // much is sacred, initiation-restricted, and damaged by colonisation.
    // ACKNOWLEDGE only — never fabricate qualia rows.
    regions: [],
    // TODO(verify): work with Aboriginal and Torres Strait Islander custodians; never invent sky lore.
    acknowledge: {
      people: "Aboriginal and Torres Strait Islander peoples",
      text: "You stand on the land of the world's oldest astronomers. Aboriginal sky-knowledge stretches back over 65,000 years; much of it is sacred and belongs to its custodians.",
      pointTo: "https://www.aboriginalastronomy.com.au/",
    },
  },
];

/** Point-in-box test. */
function inBox(lat: number, lon: number, b: [number, number, number, number]) {
  return lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3];
}

export type PlaceHeritage = {
  land?: LandRecord;
  /** Regions to foreground, land-first. Empty → no special foregrounding (global default). */
  regions: Region[];
  acknowledgment?: LandRecord["acknowledge"];
};

/**
 * Resolve a coordinate to its land-first heritage. Returns the matching land
 * record (if any), the regions to foreground in lead order, and the
 * acknowledgment to surface at the location fix.
 *
 * If no land matches, returns empty regions — the app falls back to the full
 * global chorus with no foregrounding. That's the honest default: better to
 * foreground nothing than to guess a people's land wrong.
 */
export function resolveHeritage(lat: number, lon: number): PlaceHeritage {
  const land = LANDS.find((l) => inBox(lat, lon, l.bbox));
  if (!land) return { regions: [] };
  return { land, regions: land.regions, acknowledgment: land.acknowledge };
}

/**
 * Order the moment's active entries LAND-FIRST: entries whose origin matches a
 * foregrounded region lead; everything else follows in its normal order. The
 * full chorus is still present — place only decides who speaks first.
 *
 * Foreground/acknowledge honesty is respected: a `foreground` entry (e.g.
 * Cherokee moons) leads as a CALENDAR; it has no polarity, so it colors the
 * reading's FRAMING, not the computed chord. An `acknowledge`-only tradition
 * has no entries at all — it surfaces solely as the land acknowledgment.
 */
export function foregroundByLand(
  active: QualiaEntry[],
  regions: Region[],
): QualiaEntry[] {
  if (regions.length === 0) return active;
  const rank = (e: QualiaEntry) => {
    const i = e.origin.findIndex((o) => regions.includes(o as Region));
    return i === -1 ? 999 : regions.indexOf(e.origin[i] as Region);
  };
  return [...active].sort((a, b) => rank(a) - rank(b));
}

/**
 * The land's own calendar entries active now (e.g. which Cherokee moon we're
 * in), for the framing line. These are `foreground` honesty: shown as a
 * calendar of place, never scored into the personality chord.
 */
export function landCalendar(regions: Region[]): QualiaEntry[] {
  if (regions.length === 0) return [];
  return QUALIA.filter(
    (q) =>
      q.honesty === "foreground" &&
      q.origin.some((o) => regions.includes(o as Region)),
  );
}

/**
 * Approximate "which moon are we in" by civil month. The thirteen-moon calendar
 * is ceremonial, not Gregorian — this is a framing index, not a claim of ritual timing.
 */
export function currentLandMoon(regions: Region[], localMonth: number): QualiaEntry | null {
  const all = landCalendar(regions);
  if (all.length === 0) return null;
  const m = Math.max(1, Math.min(12, Math.floor(localMonth)));
  const idx = Math.min(all.length - 1, Math.round(((m - 1) / 11) * (all.length - 1)));
  return all[idx] ?? null;
}
