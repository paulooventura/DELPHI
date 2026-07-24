/** World Cycle registry contracts — one JD spine, many cultural projections. */

export type AccuracyTier = "astronomical" | "arithmetical" | "mean-orbit" | "symbolic";
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
  /** Maya correlation: delphi Kin-1 anchor vs GMT 584283 */
  mayaCorrelation: "delphi_kin1" | "gmt_584283";
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
  accuracy: AccuracyTier;
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
