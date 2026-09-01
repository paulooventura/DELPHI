// ───────────────────────────────────────────────────────────────
// TIME UNITS — humanity's sub-day time-counting compendium.
//
// Every entry here divides a single day; each is a self-describing
// record carrying not just its ratio but its PROVENANCE — where it
// came from, when, what it was for, and what it descends from. The
// clock renders a curated few; the compendium panel browses them all
// and can toggle any onto the live wheel.
//
// One structural axis matters more than culture: `anchor`.
//   • "midnight"  → fixed unit, steady ring (Babylonian spine, decimal)
//   • "sunrise"   → seasonal unit, ring "breathes" with real daylength
// The seasonal ones read from solarDay.ts so they flex authentically.
//
// Sources are given per system; ratios are exact where the tradition
// defines them exactly (most are), approximate only where noted.
// ───────────────────────────────────────────────────────────────

import type { CyclePlugin, CycleContext, CycleReading, PluginTier } from "./types";
import { resolveSolarFrame, sunriseDayFraction } from "./solarDay";

export type TimeAnchor = "midnight" | "sunrise";

/** A single unit within a system — the row the compendium expands. */
export type TimeUnitDef = {
  id: string;
  name: string;
  native?: string;
  /** How many of this unit fill one whole day. Drives the ring angle. */
  perDay: number;
  /** SI seconds per unit at the mean (fixed) rate — for the lore readout. */
  meanSeconds: number;
  /** One-line gloss of what this unit is / was used for. */
  gloss: string;
};

/** A cultural family of sub-day units sharing an origin and anchor. */
export type TimeSystemDef = {
  id: string;
  title: string;
  native?: string;
  /** Culture/lineage of origin. */
  origin: string;
  /** Rough era of formalization. */
  era: string;
  anchor: TimeAnchor;
  /** What the system was built to do. */
  purpose: string;
  /** What it descends from, if anything — the lineage thread. */
  ancestor?: string;
  /** Precision character of the numbers. */
  tier: PluginTier;
  region: string[];
  color: string;
  icon: string;
  /** The unit the clock ring tracks by default (must be one of `units`). */
  ringUnitId: string;
  units: TimeUnitDef[];
  sources: string[];
  /** Show on the default curated clock, vs compendium-only. */
  defaultEnabled: boolean;
};

// ─── The compendium ─────────────────────────────────────────────

export const TIME_SYSTEMS: TimeSystemDef[] = [
  {
    id: "babylonian_sexagesimal",
    title: "Sexagesimal spine",
    origin: "Babylon → Ptolemy",
    era: "Base-60 from c. 2000 BCE; subdivisions formalized c. 150 CE",
    anchor: "midnight",
    purpose:
      "The base-60 division of the day that everything else descends from. Ptolemy split the degree into partes minutae primae (minute) and secundae (second), continuing into thirds and fourths.",
    ancestor: "Babylonian sexagesimal counting",
    tier: "A",
    region: ["mesopotamian", "global"],
    color: "#c9a227",
    icon: "𒀭",
    ringUnitId: "second",
    defaultEnabled: false,
    units: [
      { id: "hour", name: "Hour", perDay: 24, meanSeconds: 3600, gloss: "1/24 of a day." },
      { id: "minute", name: "Minute", native: "pars minuta prima", perDay: 1440, meanSeconds: 60, gloss: "Ptolemy's 'first small part' of the hour." },
      { id: "second", name: "Second", native: "pars minuta secunda", perDay: 86400, meanSeconds: 1, gloss: "The 'second small part' — now the SI base unit." },
      { id: "third", name: "Third", native: "pars minuta tertia", perDay: 5_184_000, meanSeconds: 1 / 60, gloss: "1/60 of a second, in medieval astronomical tables." },
    ],
    sources: ["Ptolemy, Almagest", "Wikipedia: Minute; Unit of time"],
  },
  {
    id: "hebrew_helek",
    title: "Helek",
    native: "חלק",
    origin: "Babylon → Talmudic Judaism",
    era: "Lineage c. 2nd century BCE; Hillel's calendar 4th century CE",
    anchor: "sunrise",
    purpose:
      "Divides the hour into 1080 parts to time the molad — the mean lunar conjunction that anchors the Hebrew calendar. The ritual day itself counts from sunset/sunrise, not midnight.",
    ancestor: "Babylonian she ('barleycorn'), 1/72 of a time-degree",
    tier: "A",
    region: ["jewish"],
    color: "#2563eb",
    icon: "✡",
    ringUnitId: "helek",
    defaultEnabled: true,
    units: [
      { id: "shaah", name: "Sha'ah (hour)", native: "שעה", perDay: 24, meanSeconds: 3600, gloss: "Hour; 1/24 of the day." },
      { id: "helek", name: "Helek", native: "חלק", perDay: 25920, meanSeconds: 10 / 3, gloss: "1/1080 of an hour = 3⅓ s. Used to state the molad." },
      { id: "rega", name: "Rega", native: "רגע", perDay: 1_969_920, meanSeconds: (10 / 3) / 76, gloss: "1/76 of a helek — keeps the molad math integer." },
    ],
    sources: ["Wikipedia: Helek; Molad", "JewFAQ: Jewish calendar calculation"],
  },
  {
    id: "hindu_ghati",
    title: "Ghaṭi",
    native: "घटि",
    origin: "Vedic / classical India",
    era: "Vedāṅga Jyotiṣa lineage, 1st millennium BCE onward",
    anchor: "sunrise",
    purpose:
      "The everyday astrology layer: ghaṭi / pala / vipala are treated as parallels to hour / minute / second, counted from sunrise. The day holds 60 ghaṭi. Because it divides the real solar day, the ghaṭi is seasonal.",
    ancestor: "Sūrya Siddhānta and Purāṇic time schemes",
    tier: "A",
    region: ["hindu", "indian"],
    color: "#e0662b",
    icon: "🕉",
    ringUnitId: "ghati",
    defaultEnabled: true,
    units: [
      { id: "ghati", name: "Ghaṭi", native: "घटि", perDay: 60, meanSeconds: 1440, gloss: "1/60 of a day ≈ 24 min. Also nāḍī / daṇḍa." },
      { id: "pala", name: "Pala", native: "पल", perDay: 3600, meanSeconds: 24, gloss: "1/60 of a ghaṭi ≈ 24 s. Also vighaṭi." },
      { id: "prana", name: "Prāṇa", native: "प्राण", perDay: 21600, meanSeconds: 4, gloss: "A breath — 1/6 of a pala ≈ 4 s." },
      { id: "vipala", name: "Vipala", native: "विपल", perDay: 216000, meanSeconds: 0.4, gloss: "1/60 of a pala ≈ 0.4 s. Also liptā." },
    ],
    sources: ["Wikipedia: Hindu units of time", "Drik Panchang: Vedic time (Ishtakala)"],
  },
  {
    id: "hindu_muhurta",
    title: "Muhūrta",
    native: "मुहूर्त",
    origin: "Vedic / classical India",
    era: "Brāhmaṇas onward",
    anchor: "sunrise",
    purpose:
      "The auspicious-moment layer. The day is 30 muhūrtas of ~48 min each, counted from sunrise; a coarser prahara divides day and night into four watches each. Used to select ritual timing.",
    ancestor: "Shared with the ghaṭi scheme (2 ghaṭi = 1 muhūrta)",
    tier: "B",
    region: ["hindu", "indian"],
    color: "#b8541f",
    icon: "☸",
    ringUnitId: "muhurta",
    defaultEnabled: false,
    units: [
      { id: "prahara", name: "Prahara", native: "प्रहर", perDay: 8, meanSeconds: 10800, gloss: "A watch — 1/8 of the day-night ≈ 3 h." },
      { id: "muhurta", name: "Muhūrta", native: "मुहूर्त", perDay: 30, meanSeconds: 2880, gloss: "1/30 of a day ≈ 48 min. The auspicious unit." },
      { id: "kala", name: "Kalā", native: "कला", perDay: 900, meanSeconds: 96, gloss: "1/30 of a muhūrta ≈ 96 s." },
    ],
    sources: ["Wikipedia: Muhurta; Prahara", "Wikipedia: Hindu units of time"],
  },
  {
    id: "chinese_ke",
    title: "Kè",
    native: "刻",
    origin: "Imperial China",
    era: "Han through Ming; reconciled to 96/day under the Qing (1628)",
    anchor: "midnight",
    purpose:
      "China ran two parallel standards: daylight in shí-kè, night in gēng-diǎn. The kè was originally 1/100 of a day (14.4 min), later reconciled to 1/96 (15 min) to nest evenly inside the 12 double-hours when Western clocks arrived.",
    ancestor: "Water-clock (clepsydra) practice",
    tier: "A",
    region: ["chinese", "east_asian"],
    color: "#c0392b",
    icon: "刻",
    ringUnitId: "ke",
    defaultEnabled: true,
    units: [
      { id: "shi", name: "Shí (double-hour)", native: "時", perDay: 12, meanSeconds: 7200, gloss: "1/12 of a day = 2 h, named by earthly branch." },
      { id: "ke", name: "Kè (classical)", native: "刻", perDay: 100, meanSeconds: 864, gloss: "1/100 of a day = 14.4 min. The clepsydra mark." },
      { id: "fen", name: "Fēn", native: "分", perDay: 6000, meanSeconds: 14.4, gloss: "1/60 of a classical kè = 14.4 s." },
    ],
    sources: ["Wikipedia: Traditional Chinese timekeeping", "Huainanzi ch.3"],
  },
  {
    id: "french_decimal",
    title: "Decimal time",
    origin: "Revolutionary France",
    era: "Decreed 1793; mandatory use ended 1795",
    anchor: "midnight",
    purpose:
      "Humanity's boldest attempt to escape base-60: 10 hours per day, 100 minutes per hour, 100 seconds per minute — 100,000 clean decimal seconds a day. Part of the same metric drive as the meter and gram.",
    ancestor: "Metric / decimalization program",
    tier: "B",
    region: ["french", "western"],
    color: "#5b7fb4",
    icon: "⑽",
    ringUnitId: "decimal_minute",
    defaultEnabled: false,
    units: [
      { id: "decimal_hour", name: "Decimal hour", perDay: 10, meanSeconds: 8640, gloss: "1/10 of a day = 2.4 h." },
      { id: "decime", name: "Décime", perDay: 100, meanSeconds: 864, gloss: "1/10 of a decimal hour = 14.4 min." },
      { id: "decimal_minute", name: "Decimal minute", perDay: 1000, meanSeconds: 86.4, gloss: "1/100 of a decimal hour = 86.4 s." },
      { id: "decimal_second", name: "Decimal second", perDay: 100000, meanSeconds: 0.864, gloss: "1/100 of a decimal minute = 0.864 s." },
    ],
    sources: ["Wikipedia: Decimal time", "French Republican calendar decree, 1793"],
  },
  {
    id: "swatch_beat",
    title: ".beat",
    origin: "Swatch (Switzerland)",
    era: "1998",
    anchor: "midnight",
    purpose:
      "A modern decimal revival for the internet age: the day split into 1000 .beats of 86.4 s each, with NO time zones — one global count from Biel Mean Time. The newest entry in a very old lineage.",
    ancestor: "French decimal minute (identical 86.4 s length)",
    tier: "C",
    region: ["global", "internet"],
    color: "#8a8f98",
    icon: "@",
    ringUnitId: "beat",
    defaultEnabled: true,
    units: [
      { id: "beat", name: ".beat", perDay: 1000, meanSeconds: 86.4, gloss: "1/1000 of a day = 86.4 s. Zoneless, from @000 at BMT midnight." },
      { id: "centibeat", name: "Centibeat", perDay: 100000, meanSeconds: 0.864, gloss: "1/100 of a .beat — matches the French decimal second." },
    ],
    sources: ["Wikipedia: Swatch Internet Time"],
  },
];

// ─── Registry helpers ───────────────────────────────────────────

const byId = new Map(TIME_SYSTEMS.map((s) => [s.id, s]));
export function getTimeSystem(id: string): TimeSystemDef | undefined {
  return byId.get(id);
}
export function listTimeSystems(): TimeSystemDef[] {
  return [...TIME_SYSTEMS];
}

// ─── Plugin factory: fold each system into the CyclePlugin contract ─

/**
 * The ring tracks the system's `ringUnitId`. `angleDeg` is the position of
 * "now" within ONE turn of that unit's next-coarser wrap, so the ring hand
 * sweeps at the unit's native rate. For seasonal (sunrise) systems the day
 * fraction comes from the real solar frame, so the hand breathes.
 */
function resolveTimeSystem(sys: TimeSystemDef, ctx: CycleContext): CycleReading {
  const unit = sys.units.find((u) => u.id === sys.ringUnitId) ?? sys.units[0];

  let dayFrac: number; // position within the day, [0,1)
  let seasonal = false;
  if (sys.anchor === "sunrise") {
    const frame = resolveSolarFrame(ctx.instant, ctx.lat, ctx.lon);
    dayFrac = sunriseDayFraction(ctx.instant, frame);
    seasonal = !frame.polar;
  } else {
    // Midnight-anchored: fraction of the civil day in the viewer's zone.
    const secs = ctx.localHour * 3600 + ctx.localMinute * 60 + ctx.localSecond;
    dayFrac = secs / 86400;
  }

  // Which unit-index are we in, and how far through the day.
  const totalUnits = dayFrac * unit.perDay;
  const index = Math.floor(totalUnits) % unit.perDay;
  const withinUnit = totalUnits - Math.floor(totalUnits);

  // Ring hand: sweep once per day across all units of this kind.
  const angleDeg = (dayFrac * 360) % 360;

  const primary =
    unit.native ? `${index} ${unit.name} (${unit.native})` : `${index} ${unit.name}`;
  const seasonalNote = seasonal ? " · seasonal" : "";

  return {
    systemId: `time_${sys.id}`,
    title: sys.title,
    primary,
    secondary: `${unit.gloss}${seasonalNote}`,
    angleDeg,
    periodDays: 1 / unit.perDay,
    meta: {
      unitId: unit.id,
      unitIndex: index,
      withinUnit: Number(withinUnit.toFixed(4)),
      perDay: unit.perDay,
      meanSeconds: unit.meanSeconds,
      anchor: sys.anchor,
      seasonal,
      origin: sys.origin,
      era: sys.era,
      purpose: sys.purpose,
      ancestor: sys.ancestor ?? "",
    },
    accuracy: sys.anchor === "sunrise" ? "astronomical" : "civil",
    claim: "convention",
    sources: sys.sources,
    family: "meta",
    tier: sys.tier,
    region: sys.region,
    color: sys.color,
    icon: sys.icon,
    category: "time-unit",
  };
}

/** Build all sub-day time systems as CyclePlugins for the registry. */
export function timeUnitPlugins(): CyclePlugin[] {
  return TIME_SYSTEMS.map((sys) => ({
    id: `time_${sys.id}`,
    title: sys.title,
    family: "meta" as const,
    tier: sys.tier,
    region: sys.region,
    color: sys.color,
    icon: sys.icon,
    category: "time-unit",
    defaultEnabled: sys.defaultEnabled,
    resolve: (ctx: CycleContext) => resolveTimeSystem(sys, ctx),
  }));
}
