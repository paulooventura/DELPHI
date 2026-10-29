/**
 * Magnetic declination (east-positive degrees) for compass → true-north correction.
 * Computed on the device from the World Magnetic Model (lib/wmm.ts), so it needs no network.
 */

import { wmmDeclinationDeg } from "./wmm";

let cachedKey: string | null = null;
let cachedDeclinationDeg: number | null = null;

function cacheKey(latDeg: number, lonDeg: number): string {
  return `${latDeg.toFixed(2)},${lonDeg.toFixed(2)}`;
}

/** WMM declination at sea level for today. */
export function estimateDeclinationDeg(latDeg: number, lonDeg: number): number {
  const d = wmmDeclinationDeg(latDeg, lonDeg);
  return Number.isFinite(d) ? d : 0;
}

export function getCachedDeclinationDeg(): number | null {
  return cachedDeclinationDeg;
}

export function setDeclinationDeg(deg: number): void {
  cachedDeclinationDeg = deg;
}

/** Resolve declination for observer; uses cache when lat/lon unchanged. */
export async function fetchDeclinationDeg(latDeg: number, lonDeg: number): Promise<number> {
  const key = cacheKey(latDeg, lonDeg);
  if (cachedKey === key && cachedDeclinationDeg != null) return cachedDeclinationDeg;
  const d = estimateDeclinationDeg(latDeg, lonDeg);
  cachedKey = key;
  cachedDeclinationDeg = d;
  return d;
}
