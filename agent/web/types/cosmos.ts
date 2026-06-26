// ───────────────────────────────────────────────────────────────
// COSMOS · shared types
// ───────────────────────────────────────────────────────────────

export type TabId = 'sky' | 'clock' | 'moment';

export interface GeoCoords {
  lat: number;
  lon: number;
}

export interface SensorData {
  alpha: number; // compass heading  (z)
  beta: number;  // front-back tilt  (x)
  gamma: number; // left-right tilt  (y)
  available: boolean;
  permission: 'unknown' | 'granted' | 'denied' | 'unsupported';
}

export interface WeatherData {
  tempC: number;
  code: number;          // WMO weather code
  description: string;
  isDay: boolean;
  cloudCover: number;    // %
  windKph: number;
  fetchedAt: number;     // epoch ms
}

export interface UserProfile {
  name?: string;
  birthISO?: string;     // ISO datetime of birth
  birthCoords?: GeoCoords;
}

// A single celestial body resolved for a given instant.
export interface CelestialBody {
  id: string;
  label: string;
  kind: 'sun' | 'moon' | 'planet' | 'star';
  ra: number;            // right ascension, degrees 0–360
  dec: number;           // declination, degrees -90–90
  magnitude?: number;
  glyph?: string;
  archetype?: string;
}

// One cultural cycle ring resolved to "where is the pointer now".
export interface CycleState {
  id: string;
  ring: string;          // human ring name
  activeIndex: number;
  count: number;
  label: string;         // active segment label
  detail?: string;
  fraction: number;      // 0–1 progress through the active segment
  rotation: number;      // degrees to rotate ring so active sits at 12 o'clock
  culture: string;
  blurb: string;         // history shown in flyout
}

export interface MomentReading {
  headline: string;
  body: string;
  shadow: string;
  focus: string;
  tags: string[];
}
