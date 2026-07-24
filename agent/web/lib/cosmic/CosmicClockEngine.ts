import { getCycleSnapshot } from "../cycleSystems";
import { computePhases } from "../phase/engine";
import { jdFromDate } from "../phase/timeResolution";
import { computeSolarDayEvents } from "./astronomy";
import {
  muhurtaPhase,
  normalizeDeg,
  PRECESSION_PERIOD_YEARS,
  solarDayAngleDeg,
  tideCycle,
} from "./math";
import { buildSensorSnapshot, luxToSpectrum } from "./sensors";
import type { CosmicClockInput, CosmicClockState, CycleLayer } from "./types";

const CHINESE_ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];

/**
 * Central clock engine: one baseline timestamp drives every concentric cycle layer.
 * Mirrors the native Cosmic Clock architecture (Swift/Kotlin) in TypeScript for the web app.
 */
export class CosmicClockEngine {
  private input: CosmicClockInput;
  private lux: number | null = null;
  private pressureHpa: number | null = null;

  constructor(input: CosmicClockInput) {
    this.input = input;
  }

  setInput(partial: Partial<CosmicClockInput>): void {
    this.input = { ...this.input, ...partial };
  }

  setLux(lux: number | null): void {
    this.lux = lux;
  }

  setPressureHpa(hpa: number | null): void {
    this.pressureHpa = hpa;
  }

  /** Compute full state matrix for a single instant (ms-precision). */
  tick(now: Date = new Date()): CosmicClockState {
    const { lat, lon } = this.input;
    const dayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const solar = computeSolarDayEvents(dayLocal, lat, lon);

    // Ephemeris spine: one pure PHASE call replaces the mean-period arithmetic.
    // Drift vs the old math ran up to ~19h for the Moon and days for Mercury.
    // tick() runs at ~60 Hz — scope to the four cycles the clock actually consumes
    // so we don't compute planet-synodic/retrograde every frame.
    const phases = computePhases(jdFromDate(now), {
      lat,
      lon,
      only: ["lunar-synodic", "solar-day", "tropical-year", "precession"],
    });
    const lunarReading = phases.byId["lunar-synodic"];
    const solarDayReading = phases.byId["solar-day"];
    const tropReading = phases.byId["tropical-year"];
    const precReading = phases.byId["precession"];

    const lunarPhase = lunarReading?.phase ?? 0;
    const lunarAngleDeg = normalizeDeg(lunarPhase * 360);
    const tide = tideCycle(now, lunarPhase);
    const muhurta = muhurtaPhase(now, solar.sunrise);
    const sunLon = tropReading
      ? normalizeDeg(Number(tropReading.meta?.solarLongitudeDeg ?? tropReading.angleDeg))
      : 0;
    const precession = precReading?.angleDeg ?? 0;
    // PHASE convention: phase 0 = local midnight, 0.5 = solar noon. The clock's
    // existing convention puts solar noon at 0°, so shift by half a cycle to keep
    // the ring visually unchanged. Fall back to the old solver if PHASE skipped it.
    const solarDayAngle = solarDayReading
      ? normalizeDeg((solarDayReading.phase - 0.5) * 360)
      : solarDayAngleDeg(now, solar.solarNoon);

    const sensors = buildSensorSnapshot({
      lat,
      lon,
      headingDeg: this.input.headingDeg,
      altitudeM: this.input.altitudeM,
      pressureHpa: this.pressureHpa ?? this.input.pressureHpa ?? null,
      lux: this.lux ?? this.input.lux ?? null,
    });
    const ui = luxToSpectrum(sensors.lux);
    const cycles = getCycleSnapshot(now);
    const cnIdx = CHINESE_ANIMALS.indexOf(cycles.chineseZodiac.animal);

    const layers: CycleLayer[] = [
      {
        id: "barometric-breath",
        name: "Atmospheric Breath",
        tier: 1,
        angleDeg: normalizeDeg(sensors.atmosphericBreath * 360),
        phase: sensors.atmosphericBreath,
        color: "#67e8f9",
        meta: {
          pressureHpa: sensors.pressureHpa,
          deltaHpa: sensors.pressureDeltaHpa,
        },
      },
      {
        id: "light-spectrum",
        name: "Light Spectrum",
        tier: 1,
        angleDeg: normalizeDeg(sensors.lightSpectrum * 360),
        phase: sensors.lightSpectrum,
        color: ui.accent,
        meta: { lux: sensors.lux },
      },
      {
        id: "solar-day",
        name: "Terrestrial Day",
        tier: 2,
        angleDeg: solarDayAngle,
        phase: solarDayAngle / 360,
        color: "#f59e0b",
        accuracy: solarDayReading?.accuracy ?? "astronomical",
        claim: "measurement",
        sources: solarDayReading?.sources ?? ["equation of time + observer longitude"],
        meta: {
          solarNoonMs: solar.solarNoon.getTime(),
          sunriseMs: solar.sunrise.getTime(),
          sunsetMs: solar.sunset.getTime(),
        },
      },
      {
        id: "lunar-synodic",
        name: "Lunar Synodic",
        tier: 3,
        angleDeg: lunarAngleDeg,
        phase: lunarPhase,
        color: "#94a3b8",
        accuracy: lunarReading?.accuracy ?? "astronomical",
        claim: "measurement",
        sources: lunarReading?.sources ?? ["astronomy-engine MoonPhase"],
        meta: {
          illumination: Math.round(Number(lunarReading?.meta?.illuminatedFraction ?? lunarPhase) * 1000) / 10,
        },
      },
      {
        id: "tidal",
        name: "Tidal Cycle",
        tier: 3,
        angleDeg: tide.angleDeg,
        phase: tide.angleDeg / 360,
        color: "#0891b2",
        meta: { label: tide.label },
      },
      {
        id: "muhurta",
        name: "Vedic Muhurta",
        tier: 4,
        angleDeg: muhurta.angleDeg,
        phase: (muhurta.index + (muhurta.angleDeg % (360 / 30)) / (360 / 30)) / 30,
        color: "#a855f7",
        meta: { index: muhurta.index, total: 30 },
      },
      {
        id: "tzolkin",
        name: "Tzolkin",
        tier: 4,
        angleDeg: normalizeDeg(((cycles.tzolkin.kin - 1) / 260) * 360),
        phase: cycles.tzolkin.kin / 260,
        color: "#7c3aed",
        meta: {
          kin: cycles.tzolkin.kin,
          sign: cycles.tzolkin.sign,
          tone: cycles.galactic.tone.name,
          tribe: `${cycles.galactic.tribe.color} ${cycles.galactic.tribe.name}`,
          affirmation: cycles.galactic.affirmation,
        },
      },
      {
        id: "chinese-zodiac",
        name: "Chinese Zodiac Day",
        tier: 4,
        angleDeg: normalizeDeg(((cnIdx >= 0 ? cnIdx : 0) / 12) * 360),
        phase: (cnIdx >= 0 ? cnIdx : 0) / 12,
        color: "#dc2626",
        meta: { animal: cycles.chineseZodiac.animal },
      },
      {
        id: "sun-ecliptic",
        name: "Solar Season",
        tier: 5,
        angleDeg: sunLon,
        phase: sunLon / 360,
        color: "#f97316",
        accuracy: tropReading?.accuracy ?? "astronomical",
        claim: "measurement",
        sources: tropReading?.sources ?? ["astronomy-engine SunPosition"],
        meta: { longitude: sunLon, sign: cycles.westernZodiac.sign },
      },
      {
        id: "precession",
        name: "Great Year",
        tier: 6,
        angleDeg: precession,
        phase: precession / 360,
        color: "#6366f1",
        accuracy: precReading?.accuracy ?? "mean-orbit",
        claim: "measurement",
        sources: precReading?.sources ?? ["IAU 2006 precession rate, linear approximation"],
        meta: { periodYears: PRECESSION_PERIOD_YEARS },
      },
    ];

    return {
      timestampMs: now.getTime(),
      now,
      sensors,
      solar,
      solarDayAngleDeg: solarDayAngle,
      lunarPhaseFraction: lunarPhase,
      lunarAngleDeg,
      tideAngleDeg: tide.angleDeg,
      tideLabel: tide.label,
      muhurtaIndex: muhurta.index,
      muhurtaAngleDeg: muhurta.angleDeg,
      sunTropicalLongitudeDeg: sunLon,
      precessionAngleDeg: precession,
      ui,
      layers,
    };
  }
}

export function createCosmicClockEngine(input: CosmicClockInput): CosmicClockEngine {
  return new CosmicClockEngine(input);
}
