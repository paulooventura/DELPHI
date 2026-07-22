import { gregorianToHijri } from "../lib/worldCycles/calendars/hijri";
import { gregorianToHebrew, hebrewMonthDisplay } from "../lib/worldCycles/calendars/hebrew";
import { gregorianToPersian } from "../lib/worldCycles/calendars/persian";
import { gregorianToEthiopian } from "../lib/worldCycles/calendars/ethiopian";
import { gregorianToChineseLunisolar } from "../lib/worldCycles/calendars/chineseLunisolar";
import { getCycleSnapshot } from "../lib/cycleSystems";
import { sunEclipticLongitudeDeg, julianDay, normalizeDeg } from "../lib/cosmic/math";

function show(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const heb = gregorianToHebrew(y, m, d);
  console.log(iso);
  console.log("  hijri", gregorianToHijri(y, m, d));
  console.log("  hebrew", heb, hebrewMonthDisplay(heb.year, heb.month));
  console.log("  persian", gregorianToPersian(y, m, d));
  console.log("  eth", gregorianToEthiopian(y, m, d));
  console.log("  zh", gregorianToChineseLunisolar(y, m, d));
}

show("2024-03-21");
show("2023-09-16");
show("2025-01-29");
show("2024-09-11");
show("2024-10-03");

const d = new Date(Date.UTC(2024, 2, 20, 12));
const lam = normalizeDeg(sunEclipticLongitudeDeg(julianDay(d)));
const snap = getCycleSnapshot(d);
console.log("lambda", lam, "sign", snap.westernZodiac);
