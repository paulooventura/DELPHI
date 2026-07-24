/** World Cycle registry contracts — one JD spine, many cultural projections. */

/** How precisely the NUMBER was derived. Precision only — not what it means. */
export type AccuracyTier =
  | "astronomical" // ephemeris-derived, sub-arcminute
  | "civil" // exact by definition — clock/calendar conventions
  | "arithmetical" // exact rule-based computation over a cultural system
  | "mean-orbit"; // real periodicity, approximated

/**
 * What KIND of claim a ring/reading makes — orthogonal to precision. A ring can be
 * an exact astronomical measurement AND an authored interpretation at once (the
 * zodiac: precise ecliptic longitude, symbolic sign attribution). Task 7 styles on
 * this, not on AccuracyTier.
 */
export type ClaimKind =
  | "measurement" // this is where the thing is
  | "convention" // this is what we agreed to call it
  | "interpretation"; // this is what someone says it means
export type PluginFamily = "calendar" | "zodiac" | "mansion" | "meta";
export type PluginTier = "A" | "B" | "C" | "D";

export type CycleContext = {
  /** Instant in UTC */
  instant: Date;
  /** Julian Day (UTC-based, matches lib/cosmic/math) */
  jd: number;
  timeZone: string;
  lat: number;
  lon: number;
  /** Local civil Y-M-D in viewer's timezone (or host local if TZ unavailable) */
  localYear: number;
  localMonth: number;
  localDay: number;
  localHour: number;
  localMinute: number;
  localSecond: number;
  dayOfYear: number;
  ayanamsa: "lahiri" | "fagan_bradley";
};

export type CycleReading = {
  systemId: string;
  title: string;
  primary: string;
  secondary?: string;
  angleDeg: number;
  periodDays: number;
  meta: Record<string, string | number | boolean>;
  /** Precision of the number. */
  accuracy: AccuracyTier;
  /** Kind of claim the reading makes (measurement vs convention vs interpretation). */
  claim: ClaimKind;
  /**
   * When several readings model the SAME thing by different systems (e.g. the Maya
   * day-count under GMT vs an app anchor), exactly one is marked canonical — the one that
   * stays true to the math (astronomically/historically grounded). Represent them all;
   * flag the true one.
   */
  canonical?: boolean;
  sources: string[];
  family: PluginFamily;
  tier: PluginTier;
  region: string[];
  color: string;
  icon: string;
  category: string;
};

export type CyclePlugin = {
  id: string;
  title: string;
  family: PluginFamily;
  tier: PluginTier;
  region: string[];
  color: string;
  icon: string;
  category: string;
  defaultEnabled: boolean;
  resolve: (ctx: CycleContext) => CycleReading;
};

export type WorldCycleSnapshot = {
  capturedAtMs: number;
  isoDate: string;
  context: CycleContext;
  readings: CycleReading[];
  byId: Record<string, CycleReading>;
};

export type AtlasPresetId = "delphi_classic" | "abrahamic" | "asia" | "planet";

export type AtlasPreset = {
  id: AtlasPresetId;
  label: string;
  blurb: string;
  systemIds: string[];
};
