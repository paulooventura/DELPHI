import { lstDeg } from "../starmap";
import {
  findSunTimeForAltitude,
  julianDay,
  normalizeDeg,
  solarDayAngleDeg,
  solarNoonLocal,
  sunEclipticLongitudeDeg,
} from "./math";
import type { SolarDayEvents } from "./types";

export function computeSolarDayEvents(dayLocal: Date, latDeg: number, lonDeg: number): SolarDayEvents {
  const noon = solarNoonLocal(dayLocal, lonDeg);
  const nadir = new Date(noon.getTime() + 12 * 3600000);

  const sunrise = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -0.833, true, lstDeg);
  const sunset = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -0.833, false, lstDeg);
  const civilDawn = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -6, true, lstDeg);
  const civilDusk = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -6, false, lstDeg);
  const nauticalDawn = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -12, true, lstDeg);
  const nauticalDusk = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -12, false, lstDeg);
  const astroDawn = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -18, true, lstDeg);
  const astroDusk = findSunTimeForAltitude(dayLocal, latDeg, lonDeg, -18, false, lstDeg);

  return {
    solarNoon: noon,
    nadir,
    sunrise,
    sunset,
    civilTwilight: { dawn: civilDawn, dusk: civilDusk },
    nauticalTwilight: { dawn: nauticalDawn, dusk: nauticalDusk },
    astronomicalTwilight: { dawn: astroDawn, dusk: astroDusk },
  };
}

export function solarEventAngleDeg(eventTime: Date, solarNoon: Date): number {
  return solarDayAngleDeg(eventTime, solarNoon);
}

// sunTropicalLongitude removed in the PHASE migration — use
// computePhases(jd, { only: ["tropical-year"] }).byId["tropical-year"].meta.solarLongitudeDeg
export function sunConstellationDegree(date: Date): number {
  return normalizeDeg(sunEclipticLongitudeDeg(julianDay(date)));
}
