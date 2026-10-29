import { NextResponse } from "next/server";
import { wmmDeclinationDeg } from "../../../../lib/wmm";

/** Kept for older app builds; the app now computes WMM declination on the device. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat1") ?? searchParams.get("lat") ?? 0);
    const lon = Number(searchParams.get("lon1") ?? searchParams.get("lon") ?? 0);
    const declinationDeg = wmmDeclinationDeg(lat, lon);
    return NextResponse.json({ declinationDeg, source: "wmm2025", lat, lon });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
