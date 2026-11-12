import { NextResponse } from "next/server";
import { getCycleSnapshot, type WeatherInfo } from "../../../lib/cycleSystems";

import tzLookup from "tz-lookup";
import { metToWeather } from "../../../lib/metNorway";

/** MET Norway asks every app to identify itself (https://api.met.no/doc/TermsOfService). */
const MET_UA = "PneumaMundi/1.0 (+https://delphi.pauloventura.org)";

/**
 * Weather for the home screen from MET Norway (T336). Coordinates are rounded to 2 decimals (about 1 km) before they
 * leave our server: MET's cache wants at most 4, and we never need more.
 */
async function fetchWeather(lat = 36.1627, lon = -86.7816, timezone = "auto", localDate?: string): Promise<WeatherInfo | undefined> {
  try {
    const la = Math.round(lat * 100) / 100;
    const lo = Math.round(lon * 100) / 100;
    let tz = timezone;
    if (!tz || tz === "auto") {
      try {
        tz = tzLookup(la, lo);
      } catch {
        tz = "UTC";
      }
    }
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${la}&lon=${lo}`;
    const res = await fetch(url, { headers: { "user-agent": MET_UA }, signal: AbortSignal.timeout(8000), next: { revalidate: 900 } });
    if (!res.ok) return undefined;
    return metToWeather(await res.json(), { lat: la, lon: lo, timeZone: tz, localDate });
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : 36.1627;
    const lon = searchParams.get("lon") ? Number(searchParams.get("lon")) : -86.7816;
    const timezone = searchParams.get("tz") ?? "auto";
    const localDate = searchParams.get("date") ?? undefined;
    const weather = await fetchWeather(lat, lon, timezone, localDate);
    // Calendar fields are always recomputed on the client in local time; ship weather only.
    const snapshot = getCycleSnapshot(new Date(), weather);
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
