/** Tier 1 = innermost sensor pulse → Tier 6 = precession rim */
export type CycleTier = 1 | 2 | 3 | 4 | 5 | 6;

export type CycleLayer = {
  id: string;
  name: string;
  tier: CycleTier;
  /** Current needle position 0–360° (12 o'clock = 0 in UI convention) */
  angleDeg: number;
  /** Normalized phase 0–1 within the cycle */
  phase: number;
  color: string;
  meta: Record<string, string | number | boolean | null>;
};

export type SensorSnapshot = {
  lat: number;
  lon: number;
  pressureHpa: number | null;
  /** Deviation from standard atmosphere (1013.25 hPa) */
  pressureDeltaHpa: number | null;
  lux: number | null;
  /** 0 = deep night amber, 1 = high-day blue */
  lightSpectrum: number;
  /** 0–1 pulsing breath from barometric deviation */
  atmosphericBreath: number;
  headingDeg: number | null;
  altitudeM: number | null;
};

export type SolarDayEvents = {
  solarNoon: Date;
  nadir: Date;
  sunrise: Date;
  sunset: Date;
  civilTwilight: { dawn: Date; dusk: Date };
  nauticalTwilight: { dawn: Date; dusk: Date };
  astronomicalTwilight: { dawn: Date; dusk: Date };
};

export type UiSpectrum = {
  /** CSS hue 200 (blue) → 35 (amber) */
  hue: number;
  warmth: number;
  /** Suggested accent for rings */
  accent: string;
};

export type CosmicClockState = {
  timestampMs: number;
  now: Date;
  sensors: SensorSnapshot;
  solar: SolarDayEvents;
  /** Terrestrial day angle: solar noon at 0° */
  solarDayAngleDeg: number;
  lunarPhaseFraction: number;
  lunarAngleDeg: number;
  tideAngleDeg: number;
  tideLabel: string;
  muhurtaIndex: number;
  muhurtaAngleDeg: number;
  sunTropicalLongitudeDeg: number;
  precessionAngleDeg: number;
  ui: UiSpectrum;
  layers: CycleLayer[];
};

export type CosmicClockInput = {
  lat: number;
  lon: number;
  headingDeg?: number | null;
  altitudeM?: number | null;
  pressureHpa?: number | null;
  lux?: number | null;
};
