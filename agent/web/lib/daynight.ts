/**
 * Day and night on the world map: the subsolar point (where the Sun is straight overhead) and the
 * night side as nested caps around the antisolar point, one per twilight band. Pure geometry so it
 * can be tested; astronomy-engine supplies the Sun's apparent place.
 */
import { Body, Equator, Observer, SiderealTime } from "astronomy-engine";

const D = Math.PI / 180;
const EARTH_CENTRE = new Observer(0, 0, 0);

/** Sun elevation thresholds, degrees: sunset (refraction + half disc), civil, nautical, astronomical. */
export const TWILIGHT = [
  { id: "day-edge", deg: -0.833 },
  { id: "civil", deg: -6 },
  { id: "nautical", deg: -12 },
  { id: "astro", deg: -18 },
] as const;

const wrap180 = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Latitude and longitude where the Sun is at the zenith right now (apparent, of date). */
export function subsolarPoint(date: Date): { lat: number; lon: number; distAu: number } {
  const eq = Equator(Body.Sun, date, EARTH_CENTRE, true, true);
  return { lat: eq.dec, lon: wrap180((eq.ra - SiderealTime(date)) * 15), distAu: eq.dist };
}

/** Plain words for the light at a place, from the Sun's elevation there. */
export function lightAt(elevDeg: number): string {
  if (elevDeg > -0.833) return "daylight";
  if (elevDeg > -6) return "civil twilight";
  if (elevDeg > -12) return "nautical twilight";
  if (elevDeg > -18) return "astronomical twilight";
  return "night";
}

/** Apparent local solar time at a longitude, in hours 0..24 (12 = the Sun on the meridian). */
export function solarTimeHours(lon: number, subsolarLon: number): number {
  return (((12 + (lon - subsolarLon) / 15) % 24) + 24) % 24;
}

export const fmtSolarTime = (h: number) => {
  const m = Math.round(h * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** The Sun's elevation in degrees seen from a point (geocentric, good to a fraction of a degree). */
export function sunElevation(lat: number, lon: number, sub: { lat: number; lon: number }): number {
  const c = Math.sin(lat * D) * Math.sin(sub.lat * D) + Math.cos(lat * D) * Math.cos(sub.lat * D) * Math.cos((lon - sub.lon) * D);
  return 90 - Math.acos(Math.max(-1, Math.min(1, c))) / D;
}

/**
 * The region where the Sun is below `elevDeg` (negative), as one GeoJSON polygon ring: a cap of
 * radius 90° + elevDeg around the antisolar point. When the cap holds a pole the ring runs once
 * round the world and closes over that pole, so it fills correctly on the globe and on a flat map.
 */
export function nightRing(sub: { lat: number; lon: number }, elevDeg: number, n = 180): Array<[number, number]> {
  const lat0 = -sub.lat * D;
  const lon0 = wrap180(sub.lon + 180) * D;
  const r = (90 + elevDeg) * D;
  const pts: Array<[number, number]> = [];
  for (let k = 0; k <= n; k++) {
    const b = (2 * Math.PI * k) / n;
    const lat = Math.asin(Math.sin(lat0) * Math.cos(r) + Math.cos(lat0) * Math.sin(r) * Math.cos(b));
    const lon = lon0 + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(lat0), Math.cos(r) - Math.sin(lat0) * Math.sin(lat));
    pts.push([lon / D, lat / D]);
  }
  for (let k = 1; k < pts.length; k++) {
    while (pts[k]![0] - pts[k - 1]![0] > 180) pts[k]![0] -= 360;
    while (pts[k]![0] - pts[k - 1]![0] < -180) pts[k]![0] += 360;
  }
  const span = pts[pts.length - 1]![0] - pts[0]![0];
  if (Math.abs(span) < 180) return pts;
  // The ring wound once round the axis: the cap holds the pole on the antisolar side.
  const pole = -sub.lat >= 0 ? 90 : -90;
  const last = pts[pts.length - 1]!;
  pts.push([last[0], pole], [pts[0]![0], pole], [pts[0]![0], pts[0]![1]]);
  return pts;
}

/** One polygon per twilight band, darkest last, for a stacked translucent fill. */
export function nightBands(date: Date): { sub: ReturnType<typeof subsolarPoint>; features: GeoJSON.Feature[] } {
  const sub = subsolarPoint(date);
  const features: GeoJSON.Feature[] = TWILIGHT.map((t, i) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [nightRing(sub, t.deg)] },
    properties: { band: i, id: t.id },
  }));
  return { sub, features };
}
