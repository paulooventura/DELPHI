import { NextResponse } from "next/server";
import {
  computeAircraftTracks,
  fetchLiveAircraft,
  generateMockAircraft,
} from "../../../../lib/cosmic/aircraftTracking";
import { fetchNearbyAirports, getAirLabsApiKey } from "../../../../lib/cosmic/airlabs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat") ?? 36.1627);
    const lon = Number(searchParams.get("lon") ?? -86.7816);
    const altM = Number(searchParams.get("alt") ?? 200);
    const observer = { latDeg: lat, lonDeg: lon, altM };

    const apiKey = getAirLabsApiKey() ?? process.env.AVIATIONSTACK_API_KEY;
    const provider = getAirLabsApiKey() ? "airlabs" as const : "aviationstack" as const;

    let source: "live" | "mock" = "mock";
    let reports;
    try {
      reports = await fetchLiveAircraft(observer, apiKey, provider);
      source = apiKey ? "live" : "mock";
    } catch {
      reports = generateMockAircraft(observer, Math.floor(Date.now() / 60000));
    }

    const now = new Date();
    const tracks = computeAircraftTracks(reports, observer);
    let nearestAirport = null;
    if (getAirLabsApiKey()) {
      try {
        const nearby = await fetchNearbyAirports(lat, lon, 80);
        nearestAirport = nearby?.nearest ?? null;
      } catch {
        /* optional context */
      }
    }

    return NextResponse.json({
      updatedAt: now.toISOString(),
      source,
      provider: getAirLabsApiKey() ? "airlabs" : apiKey ? "aviationstack" : "mock",
      observer: { lat, lon, altM },
      count: tracks.length,
      aircraft: tracks,
      nearestAirport,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
