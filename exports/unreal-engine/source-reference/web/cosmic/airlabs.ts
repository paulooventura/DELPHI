/**
 * AirLabs API helpers — shared auth, nearby airports, key probe.
 * @see https://airlabs.co/docs/
 */

const AIRLABS_BASE = "https://airlabs.co/api/v9";

export type NearbyAirport = {
  iata: string;
  icao: string;
  name: string;
  city: string;
  distanceKm: number;
  lat: number;
  lon: number;
};

export type NearbyPlaces = {
  airports: NearbyAirport[];
  nearest?: NearbyAirport;
};

export function getAirLabsApiKey(): string | undefined {
  return process.env.AIRLABS_API_KEY?.trim() || undefined;
}

export async function probeAirLabsKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${AIRLABS_BASE}/ping?api_key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchNearbyAirports(
  lat: number,
  lon: number,
  distanceKm = 80,
  apiKey?: string,
): Promise<NearbyPlaces | null> {
  const key = apiKey ?? getAirLabsApiKey();
  if (!key) return null;

  const params = new URLSearchParams({
    api_key: key,
    lat: String(lat),
    lng: String(lon),
    distance: String(distanceKm),
    _fields: "name,iata_code,icao_code,lat,lng,city,distance",
  });

  const res = await fetch(`${AIRLABS_BASE}/nearby?${params}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`AirLabs nearby: HTTP ${res.status}`);

  const json = await res.json() as {
    airports?: Array<{
      iata_code?: string;
      icao_code?: string;
      name?: string;
      city?: string;
      distance?: number;
      lat?: number;
      lng?: number;
    }>;
  };

  const airports: NearbyAirport[] = (json.airports ?? [])
    .filter(a => a.iata_code && a.lat != null && a.lng != null)
    .map(a => ({
      iata: a.iata_code!,
      icao: a.icao_code ?? "",
      name: a.name ?? a.iata_code!,
      city: a.city ?? "",
      distanceKm: a.distance ?? 0,
      lat: a.lat!,
      lon: a.lng!,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { airports, nearest: airports[0] };
}
