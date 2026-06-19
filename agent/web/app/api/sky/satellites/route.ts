import { NextResponse } from "next/server";
import {
  computeSatelliteTracks,
  resolveSatelliteCatalog,
} from "../../../lib/cosmic/satelliteTracking";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat") ?? 36.1627);
    const lon = Number(searchParams.get("lon") ?? -86.7816);
    const altM = Number(searchParams.get("alt") ?? 200);
    const live = searchParams.get("live") === "1";

    const catalog = await resolveSatelliteCatalog(live);
    const now = new Date();
    const tracks = computeSatelliteTracks(catalog, { latDeg: lat, lonDeg: lon, altM }, now);

    return NextResponse.json({
      updatedAt: now.toISOString(),
      observer: { lat, lon, altM },
      count: tracks.length,
      satellites: tracks,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
