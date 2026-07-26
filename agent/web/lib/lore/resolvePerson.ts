/**
 * Personal chord at the natal moment — from personPool only.
 * All computation runs in the browser from local birth data.
 */

import { jdFromDate } from "../phase/timeResolution";
import { byId, personPool, type QualiaEntry } from "./qualia";
import { birthToDate, type BirthRecord } from "./birthStore";
import { resolveMoment } from "./resolveMoment";
import { compose } from "./compose";

/**
 * Resolve person-pool entries active at the natal instant.
 * Reuses the same sky/calendar math as the moment resolver, then keeps only
 * ids that belong in personPool() (birth / both — never cast, never moment-only).
 */
export function resolvePerson(birth: BirthRecord): {
  entries: QualiaEntry[];
  ids: string[];
} {
  const date = birthToDate(birth);
  const jd = jdFromDate(date);
  const lat = birth.lat ?? 0;
  const lon = birth.lon ?? 0;
  const momentIds = new Set(resolveMoment(jd, lat, lon).ids);
  const allowed = new Set(personPool().map(e => e.id));
  const entries: QualiaEntry[] = [];
  for (const id of momentIds) {
    if (!allowed.has(id)) continue;
    const e = byId(id);
    if (e && e.nature !== "cast") entries.push(e);
  }
  return { entries, ids: entries.map(e => e.id) };
}

export function composePerson(birth: BirthRecord) {
  const { entries } = resolvePerson(birth);
  // Render-honesty only — same gate as the home chord.
  const forChord = entries.filter(e => e.honesty === "render");
  return { chord: compose(forChord), entries: forChord };
}
