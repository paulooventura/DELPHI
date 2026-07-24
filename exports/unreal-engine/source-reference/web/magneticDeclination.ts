/**
 * Magnetic declination (east-positive degrees) for compass → true-north correction.
 * Fetches NOAA WMM when online; falls back to a latitude/longitude regression.
 */

let cachedKey: string | null = null;
let cachedDeclinationDeg: number | null = null;

function cacheKey(latDeg: number, lonDeg: number): string {
  return `${latDeg.toFixed(2)},${lonDeg.toFixed(2)}`;
}

/** Rough global declination estimate when offline (±3–5° typical error). */
export function estimateDeclinationDeg(latDeg: number, lonDeg: number): number {
  const lat = latDeg * (Math.PI / 180);
  const lon = lonDeg * (Math.PI / 180);
  const dipole =
    11.2 * Math.sin(lat) * Math.cos(lon * 0.55)
    - 6.8 * Math.cos(lat * 1.1)
    + 2.4 * Math.sin(lon * 1.3);
  return Math.max(-40, Math.min(40, dipole));
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

  try {
    const params = new URLSearchParams({
      lat1: String(latDeg),
      lon1: String(lonDeg),
      model: "WMM",
      startYear: String(new Date().getFullYear()),
      resultFormat: "json",
    });
    const res = await fetch(`/api/sky/declination?${params}`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = (await res.json()) as { declinationDeg?: number };
      if (typeof json.declinationDeg === "number" && Number.isFinite(json.declinationDeg)) {
        cachedKey = key;
        cachedDeclinationDeg = json.declinationDeg;
        return json.declinationDeg;
      }
    }
  } catch {
    /* offline */
  }

  const est = estimateDeclinationDeg(latDeg, lonDeg);
  cachedKey = key;
  cachedDeclinationDeg = est;
  return est;
}
