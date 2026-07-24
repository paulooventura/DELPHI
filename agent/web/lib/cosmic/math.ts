const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function julianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525;
}

/** Mean obliquity of the ecliptic (degrees). */
export function obliquityDeg(jd: number): number {
  const T = julianCentury(jd);
  return 23.4392911111
    - 0.0130041667 * T
    - 0.0000001639 * T * T
    + 0.0000005036 * T * T * T;
}

/** Sun apparent ecliptic longitude λ (degrees, tropical). */
export function sunEclipticLongitudeDeg(jd: number): number {
  const T = julianCentury(jd);
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  return normalizeDeg(L0 + C);
}

export function sunDeclinationDeg(jd: number): number {
  const lambda = sunEclipticLongitudeDeg(jd) * RAD;
  const epsilon = obliquityDeg(jd) * RAD;
  return Math.asin(Math.sin(epsilon) * Math.sin(lambda)) * DEG;
}

export function sunRightAscensionHours(jd: number): number {
  const lambda = sunEclipticLongitudeDeg(jd) * RAD;
  const epsilon = obliquityDeg(jd) * RAD;
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)) * DEG;
  return normalizeDeg(alpha) / 15;
}

/** Equation of time in minutes (UTC). */
export function equationOfTimeMinutes(jd: number): number {
  const T = julianCentury(jd);
  const epsilon = obliquityDeg(jd) * RAD;
  const L0 = (280.46646 + 36000.76983 * T) * RAD;
  const M = (357.52911 + 35999.05029 * T) * RAD;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const lambda = L0 + C;
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const deltaPsi = 0; // nutation omitted for mobile-grade precision
  const eot = 4 * (lambda - alpha + deltaPsi) * DEG;
  return eot;
}

export function sunAltitudeDeg(date: Date, latDeg: number, lonDeg: number, lstDegFn: (d: Date, lon: number) => number): number {
  const jd = julianDay(date);
  const dec = sunDeclinationDeg(jd) * RAD;
  const ra = sunRightAscensionHours(jd) * 15;
  const lst = lstDegFn(date, lonDeg);
  const ha = (lst - ra) * RAD;
  const lat = latDeg * RAD;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;
}

/** Find local time (as Date UTC) when sun altitude equals target on a given civil day. */
export function findSunTimeForAltitude(
  dayLocal: Date,
  latDeg: number,
  lonDeg: number,
  targetAltDeg: number,
  rising: boolean,
  lstDegFn: (d: Date, lon: number) => number,
): Date {
  const start = new Date(dayLocal.getFullYear(), dayLocal.getMonth(), dayLocal.getDate(), 0, 0, 0, 0);
  let lo = 0;
  let hi = 24 * 60;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const t = new Date(start.getTime() + mid * 60000);
    const alt = sunAltitudeDeg(t, latDeg, lonDeg, lstDegFn);
    const above = alt > targetAltDeg;
    if (rising ? above : !above) hi = mid;
    else lo = mid;
  }
  return new Date(start.getTime() + ((lo + hi) / 2) * 60000);
}

/** Solar noon instant (correct UTC Date for observer longitude). */
export function solarNoonLocal(dayLocal: Date, lonDeg: number): Date {
  const y = dayLocal.getFullYear();
  const m = dayLocal.getMonth();
  const d = dayLocal.getDate();
  const jd = julianDay(new Date(Date.UTC(y, m, d, 12, 0, 0)));
  const eotMin = equationOfTimeMinutes(jd);
  const utcHours = 12 - lonDeg / 15 - eotMin / 60;
  const utcH = Math.floor(utcHours);
  const utcM = Math.round((utcHours - utcH) * 60);
  return new Date(Date.UTC(y, m, d, utcH, utcM, 0, 0));
}

/** Angle elapsed through solar day with noon at 0°. */
export function solarDayAngleDeg(now: Date, solarNoon: Date): number {
  const msPerDay = 86400000;
  const offset = now.getTime() - solarNoon.getTime();
  const wrapped = ((offset % msPerDay) + msPerDay) % msPerDay;
  const fromNoon = wrapped > msPerDay / 2 ? wrapped - msPerDay : wrapped;
  return normalizeDeg((fromNoon / msPerDay) * 360);
}

export const PRECESSION_PERIOD_YEARS = 25772;

export const SYNODIC_MONTH_DAYS = 29.530588853;

// lunarPhaseFraction / precessionAngleDeg removed in the PHASE migration.
// Use computePhases(jd, { only: [...] }) — see lib/phase/engine.

/**
 * Meeus Ch.47 — low-precision geocentric lunar ecliptic coordinates (degrees).
 * Accurate to ~0.1° for mobile sky maps.
 */
export function moonEclipticDeg(jd: number): { lonDeg: number; latDeg: number } {
  const T = julianCentury(jd);
  const Lp = normalizeDeg(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D = normalizeDeg(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
  const M = normalizeDeg(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
  const Mp = normalizeDeg(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
  const F = normalizeDeg(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T);
  const dr = RAD;
  const lambda =
    Lp
    + 6.289 * Math.sin(Mp * dr)
    + 1.274 * Math.sin((2 * D - Mp) * dr)
    + 0.658 * Math.sin(2 * D * dr)
    + 0.214 * Math.sin(2 * Mp * dr)
    - 0.186 * Math.sin(M * dr)
    - 0.114 * Math.sin(2 * F * dr);
  const beta =
    5.128 * Math.sin(F * dr)
    + 0.280 * Math.sin((Mp + F) * dr)
    + 0.277 * Math.sin((Mp - F) * dr)
    + 0.173 * Math.sin((2 * D - F) * dr);
  return { lonDeg: normalizeDeg(lambda), latDeg: beta };
}

export function eclipticToEquatorial(
  lonDeg: number,
  latDeg: number,
  jd: number,
): { raHours: number; decDeg: number } {
  const lon = lonDeg * RAD;
  const lat = latDeg * RAD;
  const eps = obliquityDeg(jd) * RAD;
  const sinDec = Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon);
  const decDeg = Math.asin(Math.max(-1, Math.min(1, sinDec))) * DEG;
  const y = Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps);
  const x = Math.cos(lon);
  let raDeg = Math.atan2(y, x) * DEG;
  if (raDeg < 0) raDeg += 360;
  return { raHours: raDeg / 15, decDeg };
}

/** Geocentric equatorial moon position at Julian date. */
export function moonEquatorial(jd: number): { raHours: number; decDeg: number } {
  const ecl = moonEclipticDeg(jd);
  return eclipticToEquatorial(ecl.lonDeg, ecl.latDeg, jd);
}

/** Semidiurnal tide proxy combined with spring–neap envelope from lunar phase. */
export function tideCycle(date: Date, lunarFraction: number): { angleDeg: number; label: string } {
  const semidiurnalHours = 12.4206;
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const semiPhase = (hours % semidiurnalHours) / semidiurnalHours;
  const springNeap = 1 - Math.abs(lunarFraction * 2 - 1);
  const angleDeg = normalizeDeg(semiPhase * 360);
  const label =
    semiPhase < 0.125 ? "High"
    : semiPhase < 0.375 ? "Ebb"
    : semiPhase < 0.625 ? "Low"
    : semiPhase < 0.875 ? "Flood"
    : "High";
  return { angleDeg, label: `${label} (${(springNeap * 100).toFixed(0)}% spring)` };
}

export const MUHURTA_MINUTES = 48;
export const MUHURTA_COUNT = 30;

export function muhurtaPhase(date: Date, solarSunrise?: Date): { index: number; angleDeg: number } {
  let minutesFromStart: number;
  if (solarSunrise) {
    minutesFromStart = (date.getTime() - solarSunrise.getTime()) / 60000;
    if (minutesFromStart < 0) minutesFromStart += 24 * 60;
  } else {
    minutesFromStart = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  }
  const total = minutesFromStart / MUHURTA_MINUTES;
  const index = Math.floor(total % MUHURTA_COUNT);
  const frac = total - Math.floor(total);
  const angleDeg = normalizeDeg(((index + frac) / MUHURTA_COUNT) * 360);
  return { index, angleDeg };
}
