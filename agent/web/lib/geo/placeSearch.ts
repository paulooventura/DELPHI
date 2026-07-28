/**
 * Forward geocode (city typeahead) via Open-Meteo — client-side only.
 * Birth place picks stay on-device; results are not sent to Delphi servers.
 */

export type PlaceHit = {
  id: string;
  label: string;
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
};

type OpenMeteoResult = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country?: string;
  country_code?: string;
};

function formatLabel(r: OpenMeteoResult): string {
  const name = String(r.name ?? "").trim();
  const admin = String(r.admin1 ?? "").trim();
  const country = String(r.country ?? r.country_code ?? "").trim();
  const parts = [name];
  if (admin && admin.toLowerCase() !== name.toLowerCase()) parts.push(admin);
  if (country) parts.push(country);
  return parts.filter(Boolean).join(", ");
}

/** Search cities/places. Returns [] for short queries or network failure. */
export async function searchPlaces(
  query: string,
  opts?: { count?: number; signal?: AbortSignal },
): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const count = opts?.count ?? 6;
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`;
    const res = await fetch(url, {
      signal: opts?.signal ?? AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: OpenMeteoResult[] };
    const rows = Array.isArray(json.results) ? json.results : [];
    return rows
      .filter(
        r =>
          typeof r.latitude === "number" &&
          typeof r.longitude === "number" &&
          String(r.name ?? "").trim(),
      )
      .map(r => ({
        id: String(r.id ?? `${r.name}-${r.latitude}-${r.longitude}`),
        name: String(r.name).trim(),
        admin1: r.admin1 ? String(r.admin1) : undefined,
        country: r.country ? String(r.country) : r.country_code ? String(r.country_code) : undefined,
        label: formatLabel(r),
        lat: r.latitude as number,
        lon: r.longitude as number,
      }));
  } catch {
    return [];
  }
}
