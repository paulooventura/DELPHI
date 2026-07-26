/**
 * Birth data — LOCAL ONLY.
 * ----------------------------------------------------------------------------
 * Natal inputs are computed and persisted on-device (localStorage). They are
 * never transmitted: no fetch, no analytics, no distill API body. The YOU layer
 * reads this store in the browser; the server never sees it.
 */

export type BirthRecord = {
  year: number;
  month: number; // 1–12
  day: number;
  /** Optional local clock; noon if omitted. */
  hour?: number;
  minute?: number;
  /** Display label only (city name). Not geocoded server-side. */
  placeLabel?: string;
  lat?: number;
  lon?: number;
};

const KEY = "delphi-birth-v1";

export function loadBirth(): BirthRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BirthRecord;
    if (!parsed?.year || !parsed?.month || !parsed?.day) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist locally. Never call fetch or send this object off-device. */
export function saveBirth(record: BirthRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(record));
}

export function clearBirth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

/** Build a Date in the browser's local zone from the civil birth fields. */
export function birthToDate(b: BirthRecord): Date {
  return new Date(
    b.year,
    b.month - 1,
    b.day,
    b.hour ?? 12,
    b.minute ?? 0,
    0,
    0,
  );
}
