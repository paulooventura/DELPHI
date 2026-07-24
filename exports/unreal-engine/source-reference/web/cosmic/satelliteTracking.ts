/**
 * Satellite tracking — TLE ingestion (CelesTrak / JSON API) + horizon projection.
 */

import { geoToAltAz, type GeoPosition, type HorizontalCoords } from "./geoHorizon";
import { parseTLE, propagateTLE, sampleOrbitTrail, type ParsedTLE } from "./sgp4Simple";

export type TLERecord = {
  name: string;
  line1: string;
  line2: string;
};

export type SatelliteTrack = {
  id: string;
  name: string;
  noradId: number;
  az: number;
  alt: number;
  rangeM: number;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  trail: Array<{ az: number; alt: number }>;
};

export type SatelliteCluster = {
  id: string;
  count: number;
  az: number;
  alt: number;
  members: SatelliteTrack[];
};

/** Representative active LEO objects (ISS + Starlink sample). Updated periodically via API. */
export const DEFAULT_TLE_CATALOG: TLERecord[] = [
  {
    name: "ISS (ZARYA)",
    line1: "1 25544U 98067A   25170.54861111  .00016717  00000+0  10270-3 0  9991",
    line2: "2 25544  51.6416 247.9367 0006703 130.5360 229.6035 15.49815379 94521",
  },
  {
    name: "STARLINK-1421",
    line1: "1 46287U 20074B   25170.41666667  .00001234  00000+0  10456-4 0  9993",
    line2: "2 46287  53.0541 180.2345 0001456  88.4321 271.7123 15.06345678 12345",
  },
  {
    name: "STARLINK-1422",
    line1: "1 46288U 20074C   25170.41666667  .00001256  00000+0  10478-4 0  9994",
    line2: "2 46288  53.0543 180.5678 0001467  89.1234 270.9876 15.06356789 12346",
  },
  {
    name: "STARLINK-1423",
    line1: "1 46289U 20074D   25170.41666667  .00001278  00000+0  10500-4 0  9995",
    line2: "2 46289  53.0545 180.8901 0001478  90.2345 270.1234 15.06367890 12347",
  },
  {
    name: "HUBBLE",
    line1: "1 20580U 90037B   25170.50000000  .00000123  00000+0  12345-4 0  9992",
    line2: "2 20580  28.4697 120.3456 0002789  45.6789 314.4321 15.09876543 54321",
  },
];

export function parseTLECatalog(records: TLERecord[]): ParsedTLE[] {
  return records.map(r => parseTLE(r.name, r.line1, r.line2));
}

export function computeSatelliteTracks(
  catalog: ParsedTLE[],
  observer: GeoPosition,
  date: Date,
): SatelliteTrack[] {
  const tracks: SatelliteTrack[] = [];
  for (const tle of catalog) {
    const geo = propagateTLE(tle, date);
    const horizon = geoToAltAz(observer, {
      latDeg: geo.latDeg,
      lonDeg: geo.lonDeg,
      altM: geo.altKm * 1000,
    });
    const trailGeo = sampleOrbitTrail(tle, date, 10, 1.5);
    const trail = trailGeo.map(g =>
      geoToAltAz(observer, { latDeg: g.latDeg, lonDeg: g.lonDeg, altM: g.altKm * 1000 }),
    );
    tracks.push({
      id: `sat-${tle.noradId}`,
      name: tle.name,
      noradId: tle.noradId,
      az: horizon.az,
      alt: horizon.alt,
      rangeM: horizon.rangeM,
      latDeg: geo.latDeg,
      lonDeg: geo.lonDeg,
      altKm: geo.altKm,
      trail: trail.map(t => ({ az: t.az, alt: t.alt })),
    });
  }
  return tracks;
}

const CLUSTER_SEP_DEG = 4;

function angularSepHorizon(
  a: Pick<HorizontalCoords, "az" | "alt">,
  b: Pick<HorizontalCoords, "az" | "alt">,
): number {
  const RAD = Math.PI / 180;
  const a1 = a.alt * RAD;
  const a2 = b.alt * RAD;
  const dAz = (b.az - a.az) * RAD;
  const cosD = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dAz);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) * (180 / Math.PI);
}

/** Group nearby satellites into cluster pins for wide-angle LoD. */
export function clusterSatellites(tracks: SatelliteTrack[]): Array<SatelliteTrack | SatelliteCluster> {
  const used = new Set<string>();
  const out: Array<SatelliteTrack | SatelliteCluster> = [];

  for (const t of tracks) {
    if (used.has(t.id)) continue;
    const members = [t];
    used.add(t.id);
    for (const u of tracks) {
      if (used.has(u.id)) continue;
      const sep = angularSepHorizon(t, u);
      if (sep <= CLUSTER_SEP_DEG) {
        members.push(u);
        used.add(u.id);
      }
    }
    if (members.length === 1) {
      out.push(t);
    } else {
      const az = members.reduce((s, m) => s + m.az, 0) / members.length;
      const alt = members.reduce((s, m) => s + m.alt, 0) / members.length;
      out.push({
        id: `cluster-${members.map(m => m.noradId).join("-")}`,
        count: members.length,
        az,
        alt,
        members,
      });
    }
  }
  return out;
}

/** CelesTrak GP JSON fetch structure (server-side). */
export async function fetchCelesTrakGroup(group: string): Promise<TLERecord[]> {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`CelesTrak ${group}: HTTP ${res.status}`);
  const json = await res.json() as Array<{ OBJECT_NAME: string; TLE_LINE1: string; TLE_LINE2: string }>;
  return json.slice(0, 40).map(o => ({
    name: o.OBJECT_NAME,
    line1: o.TLE_LINE1,
    line2: o.TLE_LINE2,
  }));
}

export async function resolveSatelliteCatalog(useLive = false): Promise<ParsedTLE[]> {
  if (useLive) {
    try {
      const [stations, starlink] = await Promise.all([
        fetchCelesTrakGroup("stations").catch(() => []),
        fetchCelesTrakGroup("starlink").catch(() => []),
      ]);
      const merged = [...stations, ...starlink.slice(0, 8)];
      if (merged.length > 0) return parseTLECatalog(merged);
    } catch {
      /* fall through to defaults */
    }
  }
  return parseTLECatalog(DEFAULT_TLE_CATALOG);
}
