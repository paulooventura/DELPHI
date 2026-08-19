/**
 * Canonical observer for DELPHI sky accuracy.
 *
 * Paulo's home (Nashville) is the GPS fallback and the location this agent
 * uses to verify the skymap against the real sky without a phone in hand.
 * Magnetic declination is WMM-era west for this site (~4.4° W in 2026).
 */
export const HOME_LAT = 36.1627;
export const HOME_LON = -86.7816;
export const HOME_ALT_M = 180;
/** East-positive. Nashville 2026 ≈ 4.4° west of true north. */
export const HOME_DECLINATION_DEG = -4.4;

export const HOME_OBSERVER = {
  lat: HOME_LAT,
  lon: HOME_LON,
  altM: HOME_ALT_M,
  declinationDeg: HOME_DECLINATION_DEG,
  label: "Nashville, TN",
} as const;

export function isNearHome(latDeg: number, lonDeg: number, radiusDeg = 1.5): boolean {
  return Math.abs(latDeg - HOME_LAT) < radiusDeg && Math.abs(lonDeg - HOME_LON) < radiusDeg;
}
