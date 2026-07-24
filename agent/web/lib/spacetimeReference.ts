import type { CosmicClockState } from "./cosmic";
import type { CosmicTimeSnapshot } from "./timeEngine";
import { ringCycleFraction } from "./timeEngine";
import { julianDay, sunEclipticLongitudeDeg } from "./cosmic/math";
import { lstDeg } from "./starmap";
import { buildSpacetimeSnapshot, formatLat, formatLon } from "./spacetime";

/**
 * Navigation-data trust for the Spacetime Anchor chips. This is a MEASUREMENT-
 * RELIABILITY axis (how much to trust a GPS fix / ephemeris value / calendar count for
 * *navigation*), NOT the clock rings' ClaimKind (what kind of claim a ring makes).
 *
 * Do NOT fold this into ClaimKind. Collapsing the two was considered and rejected: it
 * would recreate exactly the field-overloading the AccuracyTier/ClaimKind split unwound.
 * "measured/computed/cultural" here answers "can I rely on this coordinate?"; ClaimKind
 * answers "is this measured, agreed, or authored?". Different questions, different fields.
 */
export type ProvenanceTier = "measured" | "computed" | "cultural";

export type FixQuality = "live" | "fallback" | "denied" | "off";

export type CompassConfidence = "high" | "medium" | "low" | "unknown";

export type NavigationChip = {
  label: string;
  value: string;
  tier: ProvenanceTier;
};

export type NavigationReference = {
  narrative: string;
  chips: NavigationChip[];
  lstClock: string;
  solarSign: string;
  solarLambdaDeg: number;
  lunarIllumPct: number;
  lunarPhaseName: string;
  nextEvent: { label: string; countdown: string } | null;
  fixQuality: FixQuality;
  fixDetail: string;
  compassConfidence: CompassConfidence;
  compassDetail: string;
};

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

function formatLstClock(date: Date, lonDeg: number): string {
  const hours = lstDeg(date, lonDeg) / 15;
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  const s = Math.floor((((hours - Math.floor(hours)) * 60) - m) * 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}h ${pad(m)}m ${pad(s)}s`;
}

function formatCountdown(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function fmtHm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function solarSignFromLambda(lambdaDeg: number): string {
  return ZODIAC[Math.floor(lambdaDeg / 30) % 12] ?? "—";
}

function nextSolarEvent(
  now: Date,
  cosmic: CosmicClockState | null,
): { label: string; at: Date } | null {
  if (!cosmic?.solar) return null;
  const { sunrise, sunset, solarNoon } = cosmic.solar;
  const candidates: Array<{ label: string; at: Date }> = [];
  if (sunrise.getTime() > now.getTime()) candidates.push({ label: "Sunrise", at: sunrise });
  if (solarNoon.getTime() > now.getTime()) candidates.push({ label: "Solar noon", at: solarNoon });
  if (sunset.getTime() > now.getTime()) candidates.push({ label: "Sunset", at: sunset });
  if (candidates.length === 0) {
    const tomorrowSunrise = new Date(sunrise.getTime() + 86_400_000);
    return { label: "Sunrise", at: tomorrowSunrise };
  }
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidates[0] ?? null;
}

function resolveFixQuality(
  liveCoords: boolean,
  locationEnabled: boolean,
  locationDenied: boolean,
): FixQuality {
  if (!locationEnabled) return "off";
  if (locationDenied) return "denied";
  if (liveCoords) return "live";
  return "fallback";
}

function resolveCompassConfidence(
  heading: number | null,
  offsetDeg: number,
): { level: CompassConfidence; detail: string } {
  if (heading == null) return { level: "unknown", detail: "Enable heading for orientation" };
  const residual = Math.abs(offsetDeg);
  if (residual < 2) return { level: "high", detail: `±${residual.toFixed(1)}° residual` };
  if (residual < 8) return { level: "medium", detail: `±${residual.toFixed(1)}° — align to Sun to tighten` };
  return { level: "low", detail: `±${residual.toFixed(1)}° — calibrate compass` };
}

function ringById(snapshot: CosmicTimeSnapshot, ringId: number) {
  return snapshot.rings.find(r => r.ringId === ringId);
}

export type BuildNavigationReferenceParams = {
  now: Date;
  lat: number;
  lon: number;
  snapshot: CosmicTimeSnapshot;
  cosmic: CosmicClockState | null;
  liveCoords: boolean;
  locationEnabled: boolean;
  locationDenied: boolean;
  accuracyM: number | null;
  altM: number | null;
  compassHeading: number | null;
  compassOffsetDeg: number;
};

export function buildNavigationReference(params: BuildNavigationReferenceParams): NavigationReference {
  const {
    now, lat, lon, snapshot, cosmic,
    liveCoords, locationEnabled, locationDenied,
    accuracyM, altM, compassHeading, compassOffsetDeg,
  } = params;

  const solarLambda = sunEclipticLongitudeDeg(julianDay(now));
  const solarSign = solarSignFromLambda(solarLambda);
  const lstClock = formatLstClock(now, lon);

  const keRing = ringById(snapshot, 4);
  const tzolkinRing = ringById(snapshot, 8);
  const lunarRing = ringById(snapshot, 6);
  const zodiacRing = ringById(snapshot, 9);

  const lunarIllumPct = cosmic
    ? Math.round((1 - Math.cos(2 * Math.PI * cosmic.lunarPhaseFraction)) / 2 * 1000) / 10
    : Math.round((lunarRing?.normalizedProgress ?? 0) * 1000) / 10;

  const lunarPhaseName = lunarRing?.activeSegment.name ?? "—";
  const keNum = keRing ? keRing.activeSegment.numericalValue + 1 : null;
  const tzolkinMeta = tzolkinRing?.activeSegment.metadata ?? "";
  const kinMatch = tzolkinMeta.match(/Kin (\d+)/);
  const kin = kinMatch ? kinMatch[1] : null;

  const next = nextSolarEvent(now, cosmic);
  const fixQuality = resolveFixQuality(liveCoords, locationEnabled, locationDenied);
  const compass = resolveCompassConfidence(compassHeading, compassOffsetDeg);

  const placeShort = `${formatLat(lat)} · ${formatLon(lon)}`;

  let fixDetail = placeShort;
  if (fixQuality === "live") {
    fixDetail = accuracyM != null ? `${placeShort} ±${accuracyM.toFixed(0)} m` : `${placeShort} · live fix`;
    if (altM != null) fixDetail += ` · ${Math.round(altM)} m alt`;
  } else if (fixQuality === "fallback") {
    fixDetail = `${placeShort} · approx coords`;
  } else if (fixQuality === "denied") {
    fixDetail = "Location blocked";
  } else {
    fixDetail = "Location off";
  }

  const narrativeParts = [
    `LST ${lstClock}`,
    `☉ ${solarSign} ${(solarLambda % 30).toFixed(1)}°`,
    keNum != null ? `Kè ${keNum}` : null,
    kin ? `Kin ${kin}` : tzolkinRing?.activeSegment.name ?? null,
    `☽ ${lunarIllumPct}% ${lunarPhaseName.split(" ")[0]?.toLowerCase() ?? ""}`.trim(),
    next ? `${next.label.toLowerCase()} ${fmtHm(next.at)}` : null,
  ].filter(Boolean);

  const narrative = narrativeParts.join(" · ");

  const chips: NavigationChip[] = [
    { label: "Place", value: placeShort, tier: fixQuality === "live" ? "measured" : "computed" },
    { label: "LST", value: lstClock, tier: "computed" },
    { label: "Sun", value: `${solarSign} ${solarLambda.toFixed(1)}°`, tier: "computed" },
  ];

  if (keNum != null) chips.push({ label: "Kè", value: String(keNum), tier: "cultural" });
  if (kin) chips.push({ label: "Tzolk'in", value: `Kin ${kin}`, tier: "cultural" });
  if (zodiacRing) {
    chips.push({
      label: "Zodiac",
      value: `${zodiacRing.activeSegment.symbol} ${zodiacRing.activeSegment.name}`,
      tier: "computed",
    });
  }
  chips.push({ label: "Moon", value: `${lunarIllumPct}%`, tier: "computed" });
  if (next) {
    chips.push({
      label: next.label,
      value: `${fmtHm(next.at)} (${formatCountdown(next.at, now)})`,
      tier: "computed",
    });
  }

  return {
    narrative,
    chips,
    lstClock,
    solarSign,
    solarLambdaDeg: solarLambda,
    lunarIllumPct,
    lunarPhaseName,
    nextEvent: next ? { label: next.label, countdown: formatCountdown(next.at, now) } : null,
    fixQuality,
    fixDetail,
    compassConfidence: compass.level,
    compassDetail: compass.detail,
  };
}

/** Julian day + LST bundle for technical readouts. */
export function buildAstronomicalContext(now: Date, lat: number, lon: number) {
  const snap = buildSpacetimeSnapshot(now, lat, lon);
  return { ...snap, lstClock: formatLstClock(now, lon) };
}

/** Continuous ring angle for spring animation (0–1). */
export function ringFractionForAnimation(snapshot: CosmicTimeSnapshot, ringId: number): number {
  const ring = ringById(snapshot, ringId);
  return ring ? ringCycleFraction(ring) : 0;
}
