import { NextResponse } from "next/server";
import {
  computeAircraftTracks,
  fetchLiveAircraft,
  generateMockAircraft,
} from "../../../../lib/cosmic/aircraftTracking";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat") ?? 36.1627);
    const lon = Number(searchParams.get("lon") ?? -86.7816);
    const altM = Number(searchParams.get("alt") ?? 200);
    const observer = { latDeg: lat, lonDeg: lon, altM };

    const apiKey = process.env.AIRLABS_API_KEY ?? process.env.AVIATIONSTACK_API_KEY;
    const provider = process.env.AIRLABS_API_KEY ? "airlabs" as const : "aviationstack" as const;

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

    return NextResponse.json({
      updatedAt: now.toISOString(),
      source,
      observer: { lat, lon, altM },
      count: tracks.length,
      aircraft: tracks,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
