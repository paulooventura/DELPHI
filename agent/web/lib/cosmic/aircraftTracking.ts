/**
 * Live ADS-B aircraft layer — mock feed + Aviationstack/AirLabs integration structure.
 */

import { geoToAltAz, type GeoPosition } from "./geoHorizon";
import { inferAircraftIconKind, type AircraftIconKind } from "./skyIcons";

export type AircraftReport = {
  icao24: string;
  callsign: string;
  latDeg: number;
  lonDeg: number;
  baroAltFt: number;
  headingDeg: number;
  gsKnots: number;
  verticalRateFpm?: number;
  trail?: Array<{ latDeg: number; lonDeg: number; baroAltFt: number }>;
};

export type AircraftTrack = {
  id: string;
  callsign: string;
  az: number;
  alt: number;
  rangeM: number;
  baroAltFt: number;
  headingDeg: number;
  gsKnots: number;
  iconKind: AircraftIconKind;
  trail: Array<{ az: number; alt: number }>;
};

/** Aviationstack-compatible response shape. */
export type AviationstackResponse = {
  data: Array<{
    flight?: { iata?: string; icao?: string; number?: string };
    aircraft?: { icao24?: string };
    geography?: { latitude?: number; longitude?: number; altitude?: number; direction?: number; speed?: number };
    live?: { latitude?: number; longitude?: number; altitude?: number; direction?: number; speed?: number; updated?: string };
  }>;
};

/** AirLabs-compatible response shape. */
export type AirLabsResponse = {
  response: Array<{
    hex?: string;
    flight_iata?: string;
    lat?: number;
    lng?: number;
    alt?: number;
    dir?: number;
    speed?: number;
  }>;
};

function ftToM(ft: number): number {
  return ft * 0.3048;
}

export function aircraftReportToTrack(
  report: AircraftReport,
  observer: GeoPosition,
): AircraftTrack {
  const horizon = geoToAltAz(observer, {
    latDeg: report.latDeg,
    lonDeg: report.lonDeg,
    altM: ftToM(report.baroAltFt),
  });
  const trail = (report.trail ?? []).map(p =>
    geoToAltAz(observer, {
      latDeg: p.latDeg,
      lonDeg: p.lonDeg,
      altM: ftToM(p.baroAltFt),
    }),
  );
  return {
    id: `ac-${report.icao24}`,
    callsign: report.callsign.trim() || report.icao24.toUpperCase(),
    az: horizon.az,
    alt: horizon.alt,
    rangeM: horizon.rangeM,
    baroAltFt: report.baroAltFt,
    headingDeg: report.headingDeg,
    gsKnots: report.gsKnots,
    iconKind: inferAircraftIconKind(report.callsign, report.gsKnots, report.baroAltFt),
    trail: trail.map(t => ({ az: t.az, alt: t.alt })),
  };
}

export function computeAircraftTracks(
  reports: AircraftReport[],
  observer: GeoPosition,
): AircraftTrack[] {
  return reports.map(r => aircraftReportToTrack(r, observer));
}

/** Deterministic mock traffic around observer for demo / offline mode. */
export function generateMockAircraft(
  observer: GeoPosition,
  seed = 0,
  count = 6,
): AircraftReport[] {
  const reports: AircraftReport[] = [];
  const baseLat = observer.latDeg;
  const baseLon = observer.lonDeg;

  const flights = [
    { cs: "UAL901", alt: 35000, hdg: 270, gs: 460 },
    { cs: "DAL412", alt: 38000, hdg: 90, gs: 480 },
    { cs: "SWA1847", alt: 33000, hdg: 180, gs: 420 },
    { cs: "AAL220", alt: 36000, hdg: 45, gs: 450 },
    { cs: "FDX88", alt: 39000, hdg: 315, gs: 490 },
    { cs: "BAW117", alt: 37000, hdg: 135, gs: 470 },
    { cs: "JBU523", alt: 34000, hdg: 225, gs: 430 },
    { cs: "NKS301", alt: 32000, hdg: 0, gs: 410 },
    { cs: "LIFE1", alt: 1800, hdg: 120, gs: 95 },
    { cs: "N172SP", alt: 4500, hdg: 200, gs: 115 },
  ];

  for (let i = 0; i < Math.min(count, flights.length); i++) {
    const f = flights[i]!;
    const angle = ((seed + i * 47) % 360) * (Math.PI / 180);
    const distDeg = 0.4 + (i * 0.15) % 1.2;
    const latDeg = baseLat + distDeg * Math.cos(angle);
    const lonDeg = baseLon + distDeg * Math.sin(angle) / Math.cos(baseLat * Math.PI / 180);
    const trail: AircraftReport["trail"] = [];
    for (let j = 8; j >= 0; j--) {
      const tAngle = angle - j * 0.02;
      trail.push({
        latDeg: baseLat + distDeg * Math.cos(tAngle) - j * 0.01 * Math.cos(f.hdg * Math.PI / 180),
        lonDeg: baseLon + (distDeg * Math.sin(tAngle) - j * 0.01 * Math.sin(f.hdg * Math.PI / 180)) / Math.cos(baseLat * Math.PI / 180),
        baroAltFt: f.alt - j * 50,
      });
    }
    reports.push({
      icao24: `a${(seed + i).toString(16).padStart(5, "0")}`,
      callsign: f.cs,
      latDeg,
      lonDeg,
      baroAltFt: f.alt,
      headingDeg: f.hdg,
      gsKnots: f.gs,
      trail,
    });
  }
  return reports;
}

export function parseAviationstackResponse(json: AviationstackResponse): AircraftReport[] {
  return (json.data ?? []).flatMap(item => {
    const geo = item.live ?? item.geography;
    if (!geo?.latitude || !geo?.longitude) return [];
    const cs = item.flight?.icao ?? item.flight?.iata ?? item.flight?.number ?? "UNKN";
    return [{
      icao24: item.aircraft?.icao24 ?? cs.toLowerCase(),
      callsign: cs,
      latDeg: geo.latitude,
      lonDeg: geo.longitude,
      baroAltFt: geo.altitude ?? 30000,
      headingDeg: geo.direction ?? 0,
      gsKnots: geo.speed ?? 400,
    }];
  });
}

export function parseAirLabsResponse(json: AirLabsResponse): AircraftReport[] {
  return (json.response ?? []).flatMap(item => {
    if (item.lat == null || item.lng == null) return [];
    return [{
      icao24: item.hex ?? "unknown",
      callsign: item.flight_iata ?? item.hex ?? "UNKN",
      latDeg: item.lat,
      lonDeg: item.lng,
      baroAltFt: item.alt ?? 30000,
      headingDeg: item.dir ?? 0,
      gsKnots: item.speed ?? 400,
    }];
  });
}

export async function fetchLiveAircraft(
  observer: GeoPosition,
  apiKey?: string,
  provider: "airlabs" | "aviationstack" = "airlabs",
): Promise<AircraftReport[]> {
  if (!apiKey) return generateMockAircraft(observer, Math.floor(Date.now() / 60000));

  if (provider === "airlabs") {
    const params = new URLSearchParams({
      api_key: apiKey,
      lat: String(observer.latDeg),
      lng: String(observer.lonDeg),
      distance: "250",
    });
    const res = await fetch(`https://airlabs.co/api/v9/flights?${params}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`AirLabs: HTTP ${res.status}`);
    return parseAirLabsResponse(await res.json());
  }

  const params = new URLSearchParams({
    access_key: apiKey,
    limit: "20",
  });
  const res = await fetch(`http://api.aviationstack.com/v1/flights?${params}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Aviationstack: HTTP ${res.status}`);
  return parseAviationstackResponse(await res.json());
}
