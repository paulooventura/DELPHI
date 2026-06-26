// ───────────────────────────────────────────────────────────────
// COSMOS · astronomyEngine
// Single source of truth: every cycle reduces to one Julian Day.
// Low-precision formulae — accurate to a fraction of a degree,
// enough to drive the wheel and the sky map (not chart-grade).
// Validated anchors: vernal equinox → Aries 0.2°, summer
// solstice → Cancer 0.6°, 2012-12-21 → 4 Ajaw (GMT 584283).
// ───────────────────────────────────────────────────────────────

import type { CelestialBody, CycleState, GeoCoords } from '@/types/cosmos';

const norm360 = (x: number) => ((x % 360) + 360) % 360;
const D2R = Math.PI / 180;

export function toJD(date: Date): number {
  let y = date.getUTCFullYear();
  let m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const frac =
    (date.getUTCHours() +
      date.getUTCMinutes() / 60 +
      date.getUTCSeconds() / 3600) /
    24;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    d +
    B -
    1524.5 +
    frac
  );
}

// ── Sun & Moon ──────────────────────────────────────────────────
export function sunLongitude(JD: number): number {
  const n = JD - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = (357.528 + 0.9856003 * n) * D2R;
  return norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

export function ayanamsa(JD: number): number {
  // Lahiri, linearised
  return 23.85 + ((JD - 2451545.0) / 365.25) * 0.013972;
}

export interface MoonInfo {
  lon: number;
  phase: number; // 0 new → 180 full
  age: number; // days
  name: string;
  illum: number; // 0–1
}

export function moonInfo(JD: number): MoonInfo {
  const Dd = JD - 2451545.0;
  const L = norm360(218.316 + 13.176396 * Dd);
  const M = (134.963 + 13.064993 * Dd) * D2R;
  const lon = norm360(L + 6.289 * Math.sin(M));
  const phase = norm360(lon - sunLongitude(JD));
  const names = [
    'New',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  return {
    lon,
    phase,
    age: (phase / 360) * 29.530588,
    name: names[Math.floor(((phase + 22.5) % 360) / 45)],
    illum: (1 - Math.cos(phase * D2R)) / 2,
  };
}

// Convert an ecliptic longitude to equatorial RA/Dec (obliquity ~23.44°)
export function eclipticToEquatorial(lonDeg: number, latDeg = 0) {
  const eps = 23.439 * D2R;
  const lon = lonDeg * D2R;
  const lat = latDeg * D2R;
  const ra = Math.atan2(
    Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps),
    Math.cos(lon),
  );
  const dec = Math.asin(
    Math.sin(lat) * Math.cos(eps) +
      Math.cos(lat) * Math.sin(eps) * Math.sin(lon),
  );
  return { ra: norm360((ra / D2R)), dec: dec / D2R };
}

// ── Cultural cycle tables ───────────────────────────────────────
const WEST = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const WEST_ARCH = ['the Initiator','the Builder','the Messenger','the Nurturer','the Sovereign','the Analyst','the Harmoniser','the Alchemist','the Seeker','the Architect','the Visionary','the Mystic'];

const NAK = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','P.Phalguni','U.Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','P.Ashadha','U.Ashadha','Shravana','Dhanishta','Shatabhisha','P.Bhadra','U.Bhadra','Revati'];

const STEM = ['Jiǎ','Yǐ','Bǐng','Dīng','Wù','Jǐ','Gēng','Xīn','Rén','Guǐ'];
const STEM_EL = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];
const BRANCH = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];

const TZ = ['Imix',"Ik'","Ak'bal","K'an",'Chikchan','Kimi',"Manik'",'Lamat','Muluk','Ok','Chuwen',"Eb'","B'en",'Ix','Men',"K'ib'","Kab'an","Etz'nab'",'Kawak','Ajaw'];

const PLANET_DAY = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];

const MAYAN_EPOCH = 584283; // GMT correlation

// ── Resolve every ring for an instant ───────────────────────────
export function resolveCycles(date: Date): CycleState[] {
  const JD = toJD(date);
  const sun = sunLongitude(JD);
  const ayan = ayanamsa(JD);
  const sid = norm360(sun - ayan);
  const out: CycleState[] = [];

  // Tropical zodiac
  {
    const i = Math.floor(sun / 30);
    const frac = (sun % 30) / 30;
    out.push({
      id: 'tropical', ring: 'Tropical Zodiac', culture: 'Hellenistic',
      activeIndex: i, count: 12, fraction: frac,
      label: `${WEST[i]} ${(sun % 30).toFixed(1)}°`,
      detail: WEST_ARCH[i],
      rotation: -(i * 30 + frac * 30),
      blurb: 'The Greek synthesis of Babylonian star-omens with geometric houses and planetary rulerships. The Sun’s tropical longitude is measured from the moving vernal equinox.',
    });
  }
  // Vedic nakshatra
  {
    const seg = 360 / 27;
    const i = Math.floor(sid / seg);
    out.push({
      id: 'nakshatra', ring: '27 Nakshatras', culture: 'Vedic',
      activeIndex: i, count: 27, fraction: (sid % seg) / seg,
      label: NAK[i], rotation: -(i * seg),
      blurb: 'The lunar mansions of Jyotish — a sidereal scheme fixed to the stars rather than the equinox, each mansion carrying its own deity and quality.',
    });
  }
  // Chinese sexagenary (year granularity)
  {
    const yr = 2000 + (JD - 2451545.0) / 365.2425;
    const raw = Math.floor(yr - 1984 + 0.04);
    const idx = ((raw % 60) + 60) % 60;
    const animal = idx % 12;
    out.push({
      id: 'chinese', ring: 'Ganzhi 60-Year', culture: 'Chinese',
      activeIndex: animal, count: 12, fraction: 0,
      label: `${BRANCH[animal]}`,
      detail: `${STEM[idx % 10]} · ${STEM_EL[idx % 10]}`,
      rotation: -(animal * 30),
      blurb: 'The sexagenary cycle: ten Heavenly Stems and twelve Earthly Branches interlocking over sixty years, threaded through the Five Phases and yin-yang.',
    });
  }
  // Mayan Tzolk'in
  {
    const days = Math.floor(JD) - MAYAN_EPOCH;
    const num = ((((days + 3) % 13) + 13) % 13) + 1;
    const sign = (((days + 19) % 20) + 20) % 20;
    out.push({
      id: 'tzolkin', ring: "Tzolk'in 260", culture: 'Maya',
      activeIndex: sign, count: 20, fraction: 0,
      label: `${num} ${TZ[sign]}`, rotation: -(sign * 18),
      blurb: 'The 260-day sacred count: twenty day-signs cycling against thirteen numbers. Independent of the Old World, anchored here to the GMT correlation (4 Ajaw = 21 Dec 2012).',
    });
  }
  // Egyptian decans
  {
    const i = Math.floor(sid / 10);
    out.push({
      id: 'decan', ring: '36 Decans', culture: 'Egyptian',
      activeIndex: i, count: 36, fraction: (sid % 10) / 10,
      label: `Decan ${i + 1}`, rotation: -(i * 10),
      blurb: 'Thirty-six ten-degree segments whose heliacal risings marked the hours of night and the Egyptian year; later absorbed into Hellenistic astrology.',
    });
  }
  // Precession / Great Age
  {
    const eq = norm360(360 - ayan);
    const i = Math.floor(eq / 30);
    out.push({
      id: 'precession', ring: 'Great Age', culture: 'Astronomical',
      activeIndex: i, count: 12, fraction: (eq % 30) / 30,
      label: `Age of ${WEST[i]}`, rotation: -(i * 30 + (eq % 30)),
      blurb: 'The ~25,800-year wobble of Earth’s axis drags the vernal point backward through the constellations, defining the precessional “ages”.',
    });
  }
  return out;
}

export function planetaryDay(date: Date): string {
  return PLANET_DAY[date.getUTCDay()];
}

// Bodies for the sky map (sun, moon, naked-eye planets via mean longitudes)
export function resolveBodies(date: Date): CelestialBody[] {
  const JD = toJD(date);
  const bodies: CelestialBody[] = [];

  const sun = sunLongitude(JD);
  const se = eclipticToEquatorial(sun);
  bodies.push({ id: 'sun', label: 'Sun', kind: 'sun', glyph: '☉',
    ra: se.ra, dec: se.dec, archetype: 'the Vital Source' });

  const m = moonInfo(JD);
  const me = eclipticToEquatorial(m.lon, 5.1 * Math.sin((JD - 2451545) * 0.05));
  bodies.push({ id: 'moon', label: 'Moon', kind: 'moon', glyph: '☽',
    ra: me.ra, dec: me.dec, archetype: 'the Inner Tide' });

  // Mean-longitude planets (rough — good enough to place dots)
  const T = (JD - 2451545.0) / 36525;
  interface PlanetDef {
    id: string;
    label: string;
    glyph: string;
    lon: number;
    archetype: string;
  }
  const planets: PlanetDef[] = [
    { id: 'mercury', label: 'Mercury', glyph: '☿', lon: 252.25 + 149472.67 * T, archetype: 'the Messenger' },
    { id: 'venus', label: 'Venus', glyph: '♀', lon: 181.98 + 58517.82 * T, archetype: 'the Lover' },
    { id: 'mars', label: 'Mars', glyph: '♂', lon: 355.43 + 19140.3 * T, archetype: 'the Warrior' },
    { id: 'jupiter', label: 'Jupiter', glyph: '♃', lon: 34.35 + 3034.91 * T, archetype: 'the Benefactor' },
    { id: 'saturn', label: 'Saturn', glyph: '♄', lon: 50.08 + 1222.11 * T, archetype: 'the Teacher' },
  ];
  for (const p of planets) {
    const e = eclipticToEquatorial(norm360(p.lon));
    bodies.push({
      id: p.id, label: p.label, kind: 'planet',
      glyph: p.glyph, ra: e.ra, dec: e.dec, archetype: p.archetype,
    });
  }
  return bodies;
}

// Local sidereal time → used to orient the sky dome to the horizon
export function localSiderealTime(JD: number, lonDeg: number): number {
  const T = (JD - 2451545.0) / 36525;
  let gst =
    280.46061837 +
    360.98564736629 * (JD - 2451545.0) +
    0.000387933 * T * T;
  return norm360(gst + lonDeg);
}

export function moonInfoPublic(date: Date) {
  return moonInfo(toJD(date));
}

export type { GeoCoords };
