import { NEAREST_STARS, MOON_DISTANCE_LY, magLimitForRank, distanceLyForRank, type NearestStarData } from "./nearestStars";
import { ZODIAC_ART, type ZodiacArtDef } from "./zodiacArt";

export type StarData = {
  name: string;
  bayer: string;
  ra: number;
  dec: number;
  mag: number;
};

export type SkyObject = StarData & {
  alt: number;
  az: number;
  distanceLy?: number;
  rank?: number;
  kind?: "star" | "moon";
};

export type ConstellationHit = {
  name: string;
  starsVisible: number;
  avgAlt: number;
  avgAz: number;
  score: number;
};

export type MoonObject = SkyObject & {
  kind: "moon";
  illumination: number;
  phaseName: string;
};

export type ZodiacPlacement = {
  def: ZodiacArtDef;
  cx: number;
  cy: number;
  scale: number;
  stars: SkyObject[];
};

export const STAR_TO_CONSTELLATION: Record<string, string> = {
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
  "Proxima Cen": "Centaurus",
  "ε Eridani": "Eridanus",
  "ε Indi": "Indus",
  "Tau Ceti": "Cetus",
};

// Legacy bright-star list kept for constellation scoring
export const BRIGHT_STARS: StarData[] = NEAREST_STARS.filter(s => s.mag <= 3.5);

export function gmstDeg(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  return ((280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T) % 360 + 360) % 360;
}

export function lstDeg(date: Date, lonDeg: number): number {
  return ((gmstDeg(date) + lonDeg) % 360 + 360) % 360;
}

export function celestialToAltAz(
  raHours: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  date: Date,
): { alt: number; az: number } {
  const LST = lstDeg(date, lonDeg);
  const latRad = (latDeg * Math.PI) / 180;
  const raDeg = raHours * 15;
  const HA = ((LST - raDeg + 360) % 360);
  const haRad = (HA * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad)
    + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;

  const cosAlt = Math.cos((alt * Math.PI) / 180);
  const cosAz = cosAlt < 1e-8 ? 0
    : (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAlt);
  let az = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
  if (Math.sin(haRad) > 0) az = 360 - az;

  return { alt, az };
}

const MOON_PHASES: Array<[number, string]> = [
  [0.03, "New"], [0.22, "Waxing crescent"], [0.28, "First quarter"],
  [0.47, "Waxing gibbous"], [0.53, "Full"], [0.72, "Waning gibbous"],
  [0.78, "Last quarter"], [0.97, "Waning crescent"],
];

function moonPhaseLabel(fraction: number): string {
  const illum = Math.abs(fraction * 2 - 1);
  for (let i = MOON_PHASES.length - 1; i >= 0; i--) {
    if (illum >= MOON_PHASES[i]![0]) return MOON_PHASES[i]![1]!;
  }
  return "New";
}

export function moonPosition(latDeg: number, lonDeg: number, date: Date): MoonObject | null {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const N = ((125.1228 - 0.0529538083 * d) % 360) * (Math.PI / 180);
  const M = ((134.9634 + 13.0649929509 * d) % 360) * (Math.PI / 180);
  const F = ((93.2720 + 13.229350498 * d) % 360) * (Math.PI / 180);

  const moonLong = (N * 180 / Math.PI + 6.289 * Math.sin(M)) % 360;
  const moonLat = 5.128 * Math.sin(F);
  const eclRad = 23.4393 * (Math.PI / 180);

  const lonRad = moonLong * (Math.PI / 180);
  const latRad = moonLat * (Math.PI / 180);
  const sinDec = Math.sin(latRad) * Math.cos(eclRad)
    + Math.cos(latRad) * Math.sin(eclRad) * Math.sin(lonRad);
  const decDeg = Math.asin(Math.max(-1, Math.min(1, sinDec))) * 180 / Math.PI;
  const y = Math.sin(lonRad) * Math.cos(eclRad) - Math.tan(latRad) * Math.sin(eclRad);
  const x = Math.cos(lonRad);
  let raHours = Math.atan2(y, x) * 180 / Math.PI / 15;
  if (raHours < 0) raHours += 24;

  const { alt, az } = celestialToAltAz(raHours, decDeg, latDeg, lonDeg, date);
  const illumination = (1 - Math.cos(M)) / 2;

  return {
    name: "Moon",
    bayer: "☽",
    ra: raHours,
    dec: decDeg,
    mag: -12.6,
    alt,
    az,
    distanceLy: MOON_DISTANCE_LY,
    kind: "moon",
    illumination,
    phaseName: moonPhaseLabel(illumination),
  };
}

function starToSkyObject(star: NearestStarData, latDeg: number, lonDeg: number, date: Date): SkyObject {
  const { alt, az } = celestialToAltAz(star.ra, star.dec, latDeg, lonDeg, date);
  return {
    name: star.name,
    bayer: star.bayer,
    ra: star.ra,
    dec: star.dec,
    mag: star.mag,
    alt,
    az,
    distanceLy: star.distanceLy,
    rank: star.rank,
    kind: "star",
  };
}

export function skyObjectsInView(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  pitchDeg: number,
  date: Date,
  fovAzDeg: number,
  fovAltHalfDeg: number,
  distanceRank: number,
): { stars: SkyObject[]; moon: MoonObject | null } {
  const halfAz = fovAzDeg / 2;
  const maxMag = magLimitForRank(distanceRank);
  const maxDist = distanceLyForRank(distanceRank);

  const stars: SkyObject[] = [];
  for (const star of NEAREST_STARS) {
    if (distanceRank > 0 && star.rank > distanceRank) continue;
    if (star.distanceLy > maxDist + 0.01) continue;
    if (star.mag > maxMag) continue;

    const obj = starToSkyObject(star, latDeg, lonDeg, date);
    if (obj.alt < -5) continue;

    const dAz = ((obj.az - azimuthDeg + 540) % 360) - 180;
    const dAlt = obj.alt - pitchDeg;
    if (Math.abs(dAz) > halfAz + 5) continue;
    if (Math.abs(dAlt) > fovAltHalfDeg + 8) continue;

    stars.push(obj);
  }

  stars.sort((a, b) => a.mag - b.mag);

  let moon: MoonObject | null = null;
  if (distanceRank <= 15) {
    const m = moonPosition(latDeg, lonDeg, date);
    if (m && m.alt > -5) {
      const dAz = ((m.az - azimuthDeg + 540) % 360) - 180;
      const dAlt = m.alt - pitchDeg;
      if (Math.abs(dAz) <= halfAz + 10 && Math.abs(dAlt) <= fovAltHalfDeg + 12) {
        moon = m;
      }
    }
  }

  return { stars, moon };
}

/** @deprecated Use skyObjectsInView */
export function starsInDirection(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  date: Date,
  fovDeg = 60,
  maxMag = 3.5,
): SkyObject[] {
  return skyObjectsInView(latDeg, lonDeg, azimuthDeg, 35, date, fovDeg, 42, 100).stars
    .filter(s => s.mag <= maxMag);
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
      return { name, starsVisible, avgAlt, avgAz, score: Number(data.score.toFixed(3)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function zodiacPlacements(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  pitchDeg: number,
  fovAzHalf: number,
  fovAltHalf: number,
  date: Date,
  toXY: (az: number, alt: number) => [number, number],
  viewW: number,
  viewH: number,
  visibleStars: SkyObject[],
): ZodiacPlacement[] {
  const byName = new Map(visibleStars.map(s => [s.name, s]));
  const placements: ZodiacPlacement[] = [];

  for (const def of ZODIAC_ART) {
    const { alt, az } = celestialToAltAz(def.anchorRa, def.anchorDec, latDeg, lonDeg, date);
    if (alt < -8) continue;

    const dAz = ((az - azimuthDeg + 540) % 360) - 180;
    const dAlt = alt - pitchDeg;
    if (Math.abs(dAz) > fovAzHalf + 20 || Math.abs(dAlt) > fovAltHalf + 15) continue;

    const [cx, cy] = toXY(az, alt);
    if (cx < -50 || cx > viewW + 50 || cy < -50 || cy > viewH + 50) continue;

    const anchors = def.anchorStars
      .map(n => byName.get(n))
      .filter((s): s is SkyObject => s != null);

    const span = anchors.length >= 2
      ? Math.hypot(
          toXY(anchors[0]!.az, anchors[0]!.alt)[0] - toXY(anchors[1]!.az, anchors[1]!.alt)[0],
          toXY(anchors[0]!.az, anchors[0]!.alt)[1] - toXY(anchors[1]!.az, anchors[1]!.alt)[1],
        )
      : 52;
    const scale = Math.max(32, Math.min(95, span * 1.35));

    placements.push({ def, cx, cy, scale, stars: anchors });
  }

  return placements;
}

export { distanceLyForRank, labelForDistanceRank, magLimitForRank, MOON_DISTANCE_LY } from "./nearestStars";
