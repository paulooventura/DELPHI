/**
 * Birth data — on-device; never sent in the clear.
 * ----------------------------------------------------------------------------
 * Natal inputs are computed and persisted on-device (localStorage). No fetch,
 * no analytics, no distill API body ever carries them. The only thing that
 * leaves is the optional account backup: lib/vault encrypts this store on the
 * device with a key only the user's recovery key can unwrap.
 */

import { writeLocal } from "../localChange";

export type BirthRecord = {
  year: number;
  month: number; // 1–12
  day: number;
  /** Optional local clock; noon if omitted. */
  hour?: number;
  minute?: number;
  /** City label from on-device place search (Open-Meteo). Never sent to Delphi. */
  placeLabel?: string;
  /** Birth-place coords from the locked city pick (client geocode). */
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
  writeLocal(KEY, JSON.stringify(record));
}

export function clearBirth(): void {
  if (typeof window === "undefined") return;
  writeLocal(KEY, null);
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
