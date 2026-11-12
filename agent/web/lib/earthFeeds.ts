/** Compact shapes of the world map's public live layers (app/api/earth/[feed]). Pure, shared with tests. */

export type EarthFeed = {
  source: string;
  /** When the data was observed / forecast for (ISO). */
  at: string;
  /** [lon, lat, value, ...extra] — value is the magnitude (quakes) or the aurora chance in % (aurora). */
  points: Array<[number, number, number, string?, number?]>;
};

type Json = Record<string, unknown>;

/** USGS GeoJSON → [lon, lat, magnitude, place, time ms]. */
export function compactQuakes(j: unknown): EarthFeed {
  const feats = Array.isArray((j as Json)?.features) ? ((j as Json).features as Json[]) : [];
  const points: EarthFeed["points"] = [];
  for (const f of feats) {
    const c = (f.geometry as Json | undefined)?.coordinates as number[] | undefined;
    const p = (f.properties ?? {}) as Json;
    const mag = p.mag == null || p.mag === "" ? NaN : Number(p.mag);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(mag)) continue;
    points.push([c[0]!, c[1]!, Math.round(mag * 10) / 10, String(p.place ?? ""), Number(p.time) || 0]);
  }
  const updated = Number(((j as Json)?.metadata as Json | undefined)?.generated);
  return { source: "USGS", at: new Date(Number.isFinite(updated) ? updated : Date.now()).toISOString(), points };
}

/** NOAA OVATION grid (1° cells, chance 0-100) → only the cells with a real chance (>= 5%). */
export function compactAurora(j: unknown): EarthFeed {
  const o = (j ?? {}) as Json;
  const grid = Array.isArray(o.coordinates) ? (o.coordinates as number[][]) : [];
  const points: EarthFeed["points"] = [];
  for (const c of grid) {
    const [lon, lat, v] = c as [number, number, number];
    if (!(v >= 5)) continue;
    points.push([lon > 180 ? lon - 360 : lon, lat, v]);
  }
  const at = String(o["Forecast Time"] ?? o["Observation Time"] ?? new Date().toISOString());
  return { source: "NOAA SWPC", at, points };
}
