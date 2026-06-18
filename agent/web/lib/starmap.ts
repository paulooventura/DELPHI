// Bright star catalog — top 50 by apparent magnitude
export type StarData = {
  name: string;
  bayer: string;
  ra: number;   // Right Ascension in decimal hours (0–24)
  dec: number;  // Declination in decimal degrees (–90 to +90)
  mag: number;  // Apparent magnitude (lower = brighter)
};

export type SkyObject = StarData & {
  alt: number;  // altitude above horizon in degrees
  az: number;   // azimuth: 0=N, 90=E, 180=S, 270=W
};

export type ConstellationHit = {
  name: string;
  starsVisible: number;
  avgAlt: number;
  avgAz: number;
  score: number;
};

const STAR_TO_CONSTELLATION: Record<string, string> = {
  "Sirius": "Canis Major",
  "Canopus": "Carina",
  "Arcturus": "Bootes",
  "Rigil Kent": "Centaurus",
  "Vega": "Lyra",
  "Capella": "Auriga",
  "Rigel": "Orion",
  "Procyon": "Canis Minor",
  "Achernar": "Eridanus",
  "Betelgeuse": "Orion",
  "Hadar": "Centaurus",
  "Altair": "Aquila",
  "Aldebaran": "Taurus",
  "Antares": "Scorpius",
  "Spica": "Virgo",
  "Pollux": "Gemini",
  "Fomalhaut": "Piscis Austrinus",
  "Deneb": "Cygnus",
  "Mimosa": "Crux",
  "Regulus": "Leo",
  "Adhara": "Canis Major",
  "Castor": "Gemini",
  "Shaula": "Scorpius",
  "Bellatrix": "Orion",
  "Gacrux": "Crux",
  "Elnath": "Taurus",
  "Alnilam": "Orion",
  "Alioth": "Ursa Major",
  "Dubhe": "Ursa Major",
  "Mirfak": "Perseus",
  "Alkaid": "Ursa Major",
  "Sargas": "Scorpius",
  "Kaus Aus.": "Sagittarius",
  "Atria": "Triangulum Australe",
  "Alhena": "Gemini",
  "Peacock": "Pavo",
  "Polaris": "Ursa Minor",
  "Diphda": "Cetus",
  "Murzim": "Canis Major",
  "Alphard": "Hydra",
  "Hamal": "Aries",
  "Nunki": "Sagittarius",
  "Menkent": "Centaurus",
  "Denebola": "Leo",
  "Alpheratz": "Andromeda",
  "Almach": "Andromeda",
  "Naos": "Puppis",
  "Markab": "Pegasus",
  "Algieba": "Leo",
  "Algol": "Perseus",
  "Mira": "Cetus",
};

export const BRIGHT_STARS: StarData[] = [
  { name: "Sirius",      bayer: "α CMa", ra:  6.752, dec: -16.716, mag: -1.46 },
  { name: "Canopus",     bayer: "α Car", ra:  6.399, dec: -52.696, mag: -0.72 },
  { name: "Arcturus",    bayer: "α Boo", ra: 14.261, dec:  19.182, mag: -0.04 },
  { name: "Rigil Kent",  bayer: "α Cen", ra: 14.660, dec: -60.834, mag: -0.01 },
  { name: "Vega",        bayer: "α Lyr", ra: 18.616, dec:  38.784, mag:  0.03 },
  { name: "Capella",     bayer: "α Aur", ra:  5.278, dec:  45.998, mag:  0.08 },
  { name: "Rigel",       bayer: "β Ori", ra:  5.242, dec:  -8.202, mag:  0.12 },
  { name: "Procyon",     bayer: "α CMi", ra:  7.655, dec:   5.225, mag:  0.38 },
  { name: "Achernar",    bayer: "α Eri", ra:  1.629, dec: -57.237, mag:  0.46 },
  { name: "Betelgeuse",  bayer: "α Ori", ra:  5.920, dec:   7.407, mag:  0.42 },
  { name: "Hadar",       bayer: "β Cen", ra: 14.064, dec: -60.373, mag:  0.61 },
  { name: "Altair",      bayer: "α Aql", ra: 19.846, dec:   8.868, mag:  0.77 },
  { name: "Aldebaran",   bayer: "α Tau", ra:  4.599, dec:  16.509, mag:  0.85 },
  { name: "Antares",     bayer: "α Sco", ra: 16.490, dec: -26.432, mag:  0.96 },
  { name: "Spica",       bayer: "α Vir", ra: 13.420, dec: -11.161, mag:  0.97 },
  { name: "Pollux",      bayer: "β Gem", ra:  7.755, dec:  28.026, mag:  1.14 },
  { name: "Fomalhaut",   bayer: "α PsA", ra: 22.961, dec: -29.622, mag:  1.16 },
  { name: "Deneb",       bayer: "α Cyg", ra: 20.690, dec:  45.280, mag:  1.25 },
  { name: "Mimosa",      bayer: "β Cru", ra: 12.795, dec: -59.689, mag:  1.25 },
  { name: "Regulus",     bayer: "α Leo", ra: 10.139, dec:  11.967, mag:  1.35 },
  { name: "Adhara",      bayer: "ε CMa", ra:  6.977, dec: -28.972, mag:  1.50 },
  { name: "Castor",      bayer: "α Gem", ra:  7.577, dec:  31.888, mag:  1.58 },
  { name: "Shaula",      bayer: "λ Sco", ra: 17.560, dec: -37.103, mag:  1.63 },
  { name: "Bellatrix",   bayer: "γ Ori", ra:  5.419, dec:   6.350, mag:  1.64 },
  { name: "Gacrux",      bayer: "γ Cru", ra: 12.519, dec: -57.113, mag:  1.63 },
  { name: "Elnath",      bayer: "β Tau", ra:  5.438, dec:  28.608, mag:  1.65 },
  { name: "Alnilam",     bayer: "ε Ori", ra:  5.604, dec:  -1.202, mag:  1.70 },
  { name: "Alioth",      bayer: "ε UMa", ra: 12.900, dec:  55.959, mag:  1.77 },
  { name: "Dubhe",       bayer: "α UMa", ra: 11.062, dec:  61.751, mag:  1.79 },
  { name: "Mirfak",      bayer: "α Per", ra:  3.406, dec:  49.861, mag:  1.79 },
  { name: "Alkaid",      bayer: "η UMa", ra: 13.792, dec:  49.314, mag:  1.86 },
  { name: "Sargas",      bayer: "θ Sco", ra: 17.622, dec: -42.998, mag:  1.87 },
  { name: "Kaus Aus.",   bayer: "ε Sgr", ra: 18.403, dec: -34.384, mag:  1.85 },
  { name: "Atria",       bayer: "α TrA", ra: 16.811, dec: -69.029, mag:  1.92 },
  { name: "Alhena",      bayer: "γ Gem", ra:  6.629, dec:  16.399, mag:  1.93 },
  { name: "Peacock",     bayer: "α Pav", ra: 20.427, dec: -56.735, mag:  1.94 },
  { name: "Polaris",     bayer: "α UMi", ra:  2.530, dec:  89.264, mag:  1.97 },
  { name: "Diphda",      bayer: "β Cet", ra:  0.726, dec: -17.987, mag:  2.04 },
  { name: "Murzim",      bayer: "β CMa", ra:  6.378, dec: -17.956, mag:  1.98 },
  { name: "Alphard",     bayer: "α Hya", ra:  9.459, dec:  -8.658, mag:  1.98 },
  { name: "Hamal",       bayer: "α Ari", ra:  2.120, dec:  23.462, mag:  2.01 },
  { name: "Nunki",       bayer: "σ Sgr", ra: 18.921, dec: -26.297, mag:  2.05 },
  { name: "Menkent",     bayer: "θ Cen", ra: 14.111, dec: -36.370, mag:  2.06 },
  { name: "Denebola",    bayer: "β Leo", ra: 11.818, dec:  14.572, mag:  2.14 },
  { name: "Alpheratz",   bayer: "α And", ra:  0.139, dec:  29.091, mag:  2.07 },
  { name: "Almach",      bayer: "γ And", ra:  2.065, dec:  42.330, mag:  2.10 },
  { name: "Naos",        bayer: "ζ Pup", ra:  8.060, dec: -40.003, mag:  2.21 },
  { name: "Markab",      bayer: "α Peg", ra: 23.079, dec:  15.205, mag:  2.49 },
  { name: "Algieba",     bayer: "γ Leo", ra: 10.333, dec:  19.841, mag:  2.02 },
  { name: "Algol",       bayer: "β Per", ra:  3.136, dec:  40.956, mag:  2.12 },
  { name: "Mira",        bayer: "ο Cet", ra:  2.322, dec:  -2.978, mag:  2.00 },
];

// ─── Astronomy math ──────────────────────────────────────────────────────────

function lstDeg(date: Date, lonDeg: number): number {
  const JD   = date.getTime() / 86400000 + 2440587.5;
  const T    = (JD - 2451545.0) / 36525;
  const GMST = (280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T) % 360;
  return ((GMST + lonDeg) % 360 + 360) % 360;
}

/**
 * Return bright stars visible in a given azimuth window.
 * @param latDeg    Observer latitude (degrees)
 * @param lonDeg    Observer longitude (degrees)
 * @param azimuthDeg  Centre azimuth of the view window (0=N, 90=E …)
 * @param date      Observation date/time
 * @param fovDeg    Total horizontal field of view (default 60°)
 * @param maxMag    Faintest magnitude to include (default 3.5)
 */
export function starsInDirection(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  date: Date,
  fovDeg = 60,
  maxMag = 3.5,
): SkyObject[] {
  const LST    = lstDeg(date, lonDeg);
  const latRad = (latDeg * Math.PI) / 180;
  const half   = fovDeg / 2;

  const results: SkyObject[] = [];

  for (const star of BRIGHT_STARS) {
    if (star.mag > maxMag) continue;

    const raDeg  = star.ra * 15;                     // hours → degrees
    const HA     = ((LST - raDeg + 360) % 360);      // Hour Angle in degrees
    const haRad  = (HA * Math.PI) / 180;
    const decRad = (star.dec * Math.PI) / 180;

    const sinAlt = Math.sin(decRad) * Math.sin(latRad)
                 + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const alt = (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
    if (alt < -5) continue;

    const cosAlt = Math.cos((alt * Math.PI) / 180);
    const cosAz  = cosAlt < 1e-8 ? 0
      : (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAlt);
    let az = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
    if (Math.sin(haRad) > 0) az = 360 - az;

    // Angular offset from the centre of the field of view
    const dAz = ((az - azimuthDeg + 540) % 360) - 180;
    if (Math.abs(dAz) > half) continue;

    results.push({ ...star, alt, az });
  }

  return results.sort((a, b) => a.mag - b.mag);
}

export function relevantConstellations(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  date: Date,
  fovDeg = 90,
  maxMag = 3.5,
): ConstellationHit[] {
  const stars = starsInDirection(latDeg, lonDeg, azimuthDeg, date, fovDeg, maxMag);
  const groups = new Map<string, { stars: SkyObject[]; score: number }>();

  for (const star of stars) {
    const constellation = STAR_TO_CONSTELLATION[star.name];
    if (!constellation) continue;
    const prev = groups.get(constellation) ?? { stars: [], score: 0 };
    const magnitudeWeight = Math.max(0.4, 4.2 - star.mag);
    const altitudeWeight = Math.max(0.25, Math.min(1.1, (star.alt + 10) / 70));
    prev.stars.push(star);
    prev.score += magnitudeWeight * altitudeWeight;
    groups.set(constellation, prev);
  }

  return [...groups.entries()]
    .map(([name, data]) => {
      const starsVisible = data.stars.length;
      const avgAlt = data.stars.reduce((sum, s) => sum + s.alt, 0) / starsVisible;
      const avgAz = data.stars.reduce((sum, s) => sum + s.az, 0) / starsVisible;
      return {
        name,
        starsVisible,
        avgAlt,
        avgAz,
        score: Number(data.score.toFixed(3)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
