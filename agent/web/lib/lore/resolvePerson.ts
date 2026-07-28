/**
 * Personal chord at the natal moment — from personPool only.
 * All computation runs in the browser from local birth data.
 */

import { jdFromDate, resolveBirthTime } from "../phase/timeResolution";
import { byId, personPool, type QualiaEntry } from "./qualia";
import { birthToDate, type BirthRecord } from "./birthStore";
import { resolveMoment } from "./resolveMoment";
import { compose } from "./compose";
import {
  dreamspellKinFromDate,
  galacticDayFromKin,
  type GalacticDayReading,
} from "../galacticFrequency";

/**
 * Resolve person-pool entries active at the natal instant.
 * Reuses the same sky/calendar math as the moment resolver, then keeps only
 * ids that belong in personPool() (birth / both — never cast, never moment-only).
 *
 * When lat/lon are present, uses `resolveBirthTime` so optional birth hour
 * moves rising/decan math in the correct timezone. Missing hour → noon + approximate.
 */
export function resolvePerson(birth: BirthRecord): {
  entries: QualiaEntry[];
  ids: string[];
  jd: number;
  timeIsApproximate: boolean;
  warnings: string[];
} {
  const lat = birth.lat ?? 0;
  const lon = birth.lon ?? 0;
  let jd: number;
  let timeIsApproximate = birth.hour === undefined;
  let warnings: string[] = [];

  if (birth.lat != null && birth.lon != null) {
    const resolved = resolveBirthTime({
      year: birth.year,
      month: birth.month,
      day: birth.day,
      hour: birth.hour,
      minute: birth.minute,
      lat,
      lon,
    });
    jd = resolved.jd;
    timeIsApproximate = resolved.timeIsApproximate;
    warnings = resolved.warnings;
  } else {
    jd = jdFromDate(birthToDate(birth));
    if (timeIsApproximate) {
      warnings = [
        "Birth time unknown — local noon substituted. Rising / hour-sensitive cycles are approximate.",
      ];
    }
  }

  const momentIds = new Set(resolveMoment(jd, lat, lon).ids);
  const allowed = new Set(personPool().map(e => e.id));
  const entries: QualiaEntry[] = [];
  for (const id of momentIds) {
    if (!allowed.has(id)) continue;
    const e = byId(id);
    if (e && e.nature !== "cast") entries.push(e);
  }
  return { entries, ids: entries.map(e => e.id), jd, timeIsApproximate, warnings };
}

export function natalGalactic(birth: BirthRecord): GalacticDayReading {
  const kin = dreamspellKinFromDate(birth.year, birth.month, birth.day);
  return galacticDayFromKin(kin);
}

export function composePerson(birth: BirthRecord) {
  const { entries, timeIsApproximate, warnings } = resolvePerson(birth);
  // Render-honesty only — same gate as the home chord.
  const forChord = entries.filter(e => e.honesty === "render");
  const galactic = natalGalactic(birth);
  return {
    chord: compose(forChord),
    entries: forChord,
    galactic,
    timeIsApproximate,
    warnings,
  };
}
