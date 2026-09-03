import { sunAltitudeDeg } from "./cosmic/math";
import { lstDeg } from "./starmap";

export type SkyPeriod = "night" | "twilight" | "day";

export function skyPeriodFromAltitude(altDeg: number): SkyPeriod {
  if (altDeg >= 6) return "day";
  if (altDeg >= -12) return "twilight";
  return "night";
}

/** Civil sky band from the real sun at this place — not a clock-hour guess. */
export function skyPeriodAt(now: Date, lat: number, lon: number): SkyPeriod {
  return skyPeriodFromAltitude(sunAltitudeDeg(now, lat, lon, lstDeg));
}
