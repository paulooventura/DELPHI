import { NextResponse } from "next/server";
import { fetchNearbyAirports, getAirLabsApiKey } from "../../../../lib/cosmic/airlabs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat") ?? 36.1627);
    const lon = Number(searchParams.get("lon") ?? -86.7816);
    const distanceKm = Number(searchParams.get("distance") ?? 80);
    const key = getAirLabsApiKey();

    if (!key) {
      return NextResponse.json({
        source: "unconfigured",
        observer: { lat, lon },
        airports: [],
        nearest: null,
      });
    }

    const places = await fetchNearbyAirports(lat, lon, distanceKm, key);
    return NextResponse.json({
      source: "airlabs",
      observer: { lat, lon },
      airports: places?.airports ?? [],
      nearest: places?.nearest ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
