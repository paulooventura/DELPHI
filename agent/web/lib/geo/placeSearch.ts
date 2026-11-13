/**
 * Place search (city typeahead) and "where am I", from the place list bundled with the app (GeoNames, CC BY 4.0).
 * Since T336 (2026-11-13) nothing is sent anywhere: what you type and where you are stay on the device.
 */
import { nearestPlace, searchPlaceIndex, type PlaceData } from "./placeIndex";

export type PlaceHit = {
  id: string;
  label: string;
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
};

let loading: Promise<PlaceData | null> | null = null;

/** The list loads once, on first use (about 1.5 MB compressed), from the app's own files. */
export function loadPlaces(): Promise<PlaceData | null> {
  if (!loading) {
    loading = fetch("/geo/places.json")
      .then(r => (r.ok ? (r.json() as Promise<PlaceData>) : null))
      .catch(() => null)
      .then(d => {
        if (!d) loading = null;
        return d;
      });
  }
  return loading;
}

/** Search cities/places. Returns [] for short queries or when the list can't load. */
export async function searchPlaces(query: string, opts?: { count?: number; signal?: AbortSignal }): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const d = await loadPlaces();
  if (!d || opts?.signal?.aborted) return [];
  return searchPlaceIndex(d, q, opts?.count ?? 6).map(m => ({
    id: `gn-${m.i}`,
    label: m.label,
    name: m.name,
    admin1: m.admin1,
    country: m.country,
    lat: m.lat,
    lon: m.lon,
  }));
}

/** "NASHVILLE, TENNESSEE" for the nearest listed place, or "OBSERVATORY" when none is known. */
export async function nearestPlaceLabel(lat: number, lon: number): Promise<string> {
  const d = await loadPlaces();
  const m = d ? nearestPlace(d, lat, lon) : null;
  if (!m) return "OBSERVATORY";
  const city = m.name.toUpperCase();
  const region = (m.admin1 ?? m.country ?? "").toUpperCase();
  return region && city !== region ? `${city}, ${region}` : city || "OBSERVATORY";
}
