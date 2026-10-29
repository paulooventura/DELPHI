/**
 * How far to trust a set of orbit elements with no network. SGP4 drifts by a few km a day,
 * so positions are "approximate" after 3 days and left out after 14.
 */
export const ORBIT_APPROX_DAYS = 3;
export const ORBIT_HIDE_DAYS = 14;

export type OrbitFreshness = "fresh" | "approximate" | "expired";

export function orbitAgeDays(fetchedAt: string, now = Date.now()): number {
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, (now - t) / 86_400_000);
}

export function orbitFreshness(fetchedAt: string, now = Date.now()): OrbitFreshness {
  const d = orbitAgeDays(fetchedAt, now);
  if (d > ORBIT_HIDE_DAYS) return "expired";
  if (d > ORBIT_APPROX_DAYS) return "approximate";
  return "fresh";
}

/** "CelesTrak · approximate, 5 days old" once the set is past the fresh window. */
export function orbitSourceLabel(source: string, fetchedAt: string, now = Date.now()): string {
  if (orbitFreshness(fetchedAt, now) !== "approximate") return source;
  const days = Math.floor(orbitAgeDays(fetchedAt, now));
  return `${source} · approximate, ${days} days old`;
}

/** The newer of two sets by fetchedAt; either may be missing. */
export function newerOrbitSet<T extends { fetchedAt: string }>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.fetchedAt) > Date.parse(a.fetchedAt) ? b : a;
}
