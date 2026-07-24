/**
 * Tier 1 cycles — ephemeris-derived, sub-arcminute.
 *
 * Uses astronomy-engine (already a dependency, currently underused). This
 * replaces the mean-period arithmetic in lib/cosmic/math.ts and
 * lib/worldCycles/plugins/lunar.ts, which drift by hours for the Moon and by
 * DAYS for Mercury retrograde timing.
 *
 * Getting Mercury retrograde right is the single thing that separates this
 * from every other app in the category. Do not table it — compute it.
 */

import * as Astronomy from "astronomy-engine";
import { normalizePhase } from "../circular";
import type { PhaseCycleDefinition, PhaseContext } from "../types";

const UNIX_EPOCH_JD = 2440587.5;

function toAstroTime(jd: number): Astronomy.AstroTime {
  return Astronomy.MakeTime(new Date((jd - UNIX_EPOCH_JD) * 86400000));
}

/** Synodic phase: normalized elongation from the Sun. 0 = conjunction. */
function synodicPhase(body: Astronomy.Body, jd: number): number {
  const t = toAstroTime(jd);
  const elong = Astronomy.PairLongitude(body, Astronomy.Body.Sun, t);
  return normalizePhase(elong / 360);
}

/** Sidereal phase: ecliptic longitude against the fixed frame. */
function siderealPhase(body: Astronomy.Body, jd: number): number {
  const t = toAstroTime(jd);
  const vec = Astronomy.GeoVector(body, t, true);
  const ecl = Astronomy.Ecliptic(vec);
  return normalizePhase(ecl.elon / 360);
}

// ── Lunar ────────────────────────────────────────────────────────────────────

export const lunarSynodic: PhaseCycleDefinition = {
  id: "lunar-synodic",
  label: "Lunar (synodic)",
  kind: "oscillator",
  domain: "lunar",
  periodDays: 29.530588853,
  accuracy: "astronomical",
  sources: ["astronomy-engine MoonPhase (VSOP87/ELP2000-derived)"],
  derivation:
    "Ecliptic longitude of Moon minus Sun, normalized to [0,1). 0 = new moon, 0.5 = full.",
  requiresLocation: false,
  requiresExactTime: false,
  compute(ctx: PhaseContext) {
    const t = toAstroTime(ctx.jd);
    const angle = Astronomy.MoonPhase(t); // 0–360, 0 = new
    const phase = normalizePhase(angle / 360);
    const illum = Astronomy.Illumination(Astronomy.Body.Moon, t);
    return {
      phase,
      meta: {
        illuminatedFraction: Number(illum.phase_fraction.toFixed(4)),
        elongationDeg: Number(angle.toFixed(3)),
      },
    };
  },
};

export const lunarSidereal: PhaseCycleDefinition = {
  id: "lunar-sidereal",
  label: "Lunar (sidereal)",
  kind: "oscillator",
  domain: "lunar",
  periodDays: 27.321661,
  accuracy: "astronomical",
  sources: ["astronomy-engine geocentric ecliptic longitude of Moon"],
  derivation: "Moon's ecliptic longitude against the fixed stellar frame.",
  requiresLocation: false,
  requiresExactTime: false,
  compute: (ctx) => ({ phase: siderealPhase(Astronomy.Body.Moon, ctx.jd) }),
};

// ── Solar ────────────────────────────────────────────────────────────────────

export const tropicalYear: PhaseCycleDefinition = {
  id: "tropical-year",
  label: "Tropical year",
  kind: "oscillator",
  domain: "solar",
  periodDays: 365.242189,
  accuracy: "astronomical",
  sources: ["astronomy-engine SunPosition (apparent geocentric ecliptic longitude)"],
  derivation:
    "Sun's apparent ecliptic longitude / 360. Phase 0 = March equinox. " +
    "Southern hemisphere: seasonal meaning is offset by half a cycle.",
  requiresLocation: false,
  requiresExactTime: false,
  compute(ctx) {
    const t = toAstroTime(ctx.jd);
    const sun = Astronomy.SunPosition(t);
    const phase = normalizePhase(sun.elon / 360);
    return {
      phase,
      meta: {
        solarLongitudeDeg: Number(sun.elon.toFixed(4)),
        // Hemisphere matters: phase 0 is spring in the north, autumn in the south.
        hemisphere: ctx.hasLocation ? (ctx.lat >= 0 ? "north" : "south") : "unknown",
        seasonalPhase: ctx.hasLocation && ctx.lat < 0
          ? Number(normalizePhase(phase + 0.5).toFixed(6))
          : Number(phase.toFixed(6)),
      },
    };
  },
};

export const solarDay: PhaseCycleDefinition = {
  id: "solar-day",
  label: "Solar day",
  kind: "oscillator",
  domain: "terrestrial",
  periodDays: 1,
  accuracy: "astronomical",
  sources: ["astronomy-engine HourAngle (local apparent solar time)"],
  derivation:
    "Local hour angle of the Sun. Phase 0 = local apparent midnight, 0.5 = solar noon. " +
    "Breaks down above the polar circles where the Sun may not rise or set.",
  requiresLocation: true,
  requiresExactTime: true,
  compute(ctx) {
    const t = toAstroTime(ctx.jd);
    const observer = new Astronomy.Observer(ctx.lat, ctx.lon, 0);
    const ha = Astronomy.HourAngle(Astronomy.Body.Sun, t, observer); // hours, 0–24; 0 = culmination (solar noon)
    // Offset by half a cycle so phase 0 = local apparent midnight, 0.5 = solar noon.
    const phase = normalizePhase(ha / 24 + 0.5);
    const polar = Math.abs(ctx.lat) > 66.5;
    return {
      phase,
      meta: {
        hourAngle: Number(ha.toFixed(4)),
        polarLatitude: polar,
      },
    };
  },
};

// ── Planetary synodic (retrograde-relevant) ──────────────────────────────────

function planetSynodic(
  id: string,
  label: string,
  body: Astronomy.Body,
  periodDays: number,
): PhaseCycleDefinition {
  return {
    id,
    label,
    kind: "oscillator",
    domain: "planetary",
    periodDays,
    accuracy: "astronomical",
    sources: ["astronomy-engine PairLongitude (geocentric elongation from Sun)"],
    derivation: `Geocentric elongation of ${label} from the Sun, normalized. Computed geometrically, not from a mean period — retrograde timing is accurate.`,
    requiresLocation: false,
    requiresExactTime: false,
    compute(ctx) {
      const phase = synodicPhase(body, ctx.jd);
      const t = toAstroTime(ctx.jd);
      // Retrograde detection: is ecliptic longitude decreasing?
      const dt = 0.5; // days
      const l0 = Astronomy.Ecliptic(Astronomy.GeoVector(body, t, true)).elon;
      const l1 = Astronomy.Ecliptic(
        Astronomy.GeoVector(body, toAstroTime(ctx.jd + dt), true),
      ).elon;
      let delta = l1 - l0;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      return {
        phase,
        meta: {
          retrograde: delta < 0,
          dailyMotionDeg: Number((delta / dt).toFixed(5)),
        },
      };
    },
  };
}

export const mercurySynodic = planetSynodic(
  "mercury-synodic",
  "Mercury (synodic)",
  Astronomy.Body.Mercury,
  115.8775,
);
export const venusSynodic = planetSynodic(
  "venus-synodic",
  "Venus (synodic)",
  Astronomy.Body.Venus,
  583.921,
);
export const marsSynodic = planetSynodic(
  "mars-synodic",
  "Mars (synodic)",
  Astronomy.Body.Mars,
  779.94,
);

// ── Outer planets, sidereal ──────────────────────────────────────────────────

function planetSidereal(
  id: string,
  label: string,
  body: Astronomy.Body,
  periodDays: number,
): PhaseCycleDefinition {
  return {
    id,
    label,
    kind: "oscillator",
    domain: "planetary",
    periodDays,
    accuracy: "astronomical",
    sources: ["astronomy-engine geocentric ecliptic longitude"],
    derivation: `${label}'s ecliptic longitude against the fixed frame.`,
    requiresLocation: false,
    requiresExactTime: false,
    compute: (ctx) => ({ phase: siderealPhase(body, ctx.jd) }),
  };
}

export const jupiterSidereal = planetSidereal(
  "jupiter-sidereal",
  "Jupiter (sidereal)",
  Astronomy.Body.Jupiter,
  4332.589,
);
export const saturnSidereal = planetSidereal(
  "saturn-sidereal",
  "Saturn (sidereal)",
  Astronomy.Body.Saturn,
  10759.22,
);

// ── Precession ───────────────────────────────────────────────────────────────

export const PRECESSION_PERIOD_YEARS = 25772;

export const precession: PhaseCycleDefinition = {
  id: "precession",
  label: "Axial precession (Great Year)",
  kind: "oscillator",
  domain: "precessional",
  periodDays: PRECESSION_PERIOD_YEARS * 365.2422,
  accuracy: "mean-orbit",
  sources: ["IAU 2006 precession rate, linear approximation"],
  derivation:
    "Linear precession model at ~50.29 arcsec/year from J2000. Adequate for " +
    "millennial display; not valid for deep-time (>10 kyr) extrapolation, where " +
    "the rate itself varies.",
  requiresLocation: false,
  requiresExactTime: false,
  compute(ctx) {
    const J2000 = 2451545.0;
    const centuries = (ctx.jd - J2000) / 36525;
    // IAU 2006 general precession in longitude, arcsec
    const arcsec = 5028.796195 * centuries + 1.1054348 * centuries * centuries;
    const degrees = arcsec / 3600;
    return {
      phase: normalizePhase(degrees / 360),
      meta: { accumulatedDeg: Number(degrees.toFixed(4)) },
    };
  },
};

export const ASTRONOMICAL_CYCLES: PhaseCycleDefinition[] = [
  solarDay,
  lunarSynodic,
  lunarSidereal,
  tropicalYear,
  mercurySynodic,
  venusSynodic,
  marsSynodic,
  jupiterSidereal,
  saturnSidereal,
  precession,
];
