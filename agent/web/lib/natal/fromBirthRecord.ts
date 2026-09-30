/**
 * Bridge BirthRecord (Psyche localStorage) ↔ NatalBirthInput.
 * Also re-exports place/tz helpers used by forms.
 */

import type { BirthRecord } from "../lore/birthStore";
import { zoneForCoords } from "../phase/timeResolution";
import {
  computeNatalTriad,
  type NatalBirthInput,
  type NatalTriad,
} from "./natalTriad";

export { zoneForCoords as ianaTzFromCoords } from "../phase/timeResolution";
export { searchPlaces, type PlaceHit } from "../geo/placeSearch";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Map stored birth → triad input. Null when date or place is incomplete. */
export function birthRecordToNatalInput(b: BirthRecord): NatalBirthInput | null {
  if (!b?.year || !b?.month || !b?.day) return null;
  if (b.lat == null || b.lon == null || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) {
    return null;
  }
  const dateLocal = `${b.year}-${pad2(b.month)}-${pad2(b.day)}`;
  const timeLocal =
    b.hour !== undefined
      ? `${pad2(b.hour)}:${pad2(b.minute ?? 0)}`
      : undefined;
  let ianaTz: string | undefined;
  try {
    ianaTz = zoneForCoords(b.lat, b.lon);
  } catch {
    ianaTz = undefined;
  }
  return {
    dateLocal,
    timeLocal,
    lat: b.lat,
    lon: b.lon,
    ianaTz,
  };
}

/** Compute triad from Psyche BirthRecord, or null if place/date missing. */
export function computeNatalTriadFromBirth(b: BirthRecord | null | undefined): NatalTriad | null {
  if (!b) return null;
  const input = birthRecordToNatalInput(b);
  if (!input) return null;
  try {
    return computeNatalTriad(input);
  } catch {
    return null;
  }
}
