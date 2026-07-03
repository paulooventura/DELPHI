import { NextResponse } from "next/server";
import { estimateDeclinationDeg } from "../../../../lib/magneticDeclination";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat1") ?? searchParams.get("lat") ?? 0);
    const lon = Number(searchParams.get("lon1") ?? searchParams.get("lon") ?? 0);
    const year = searchParams.get("startYear") ?? String(new Date().getFullYear());

    let declinationDeg = estimateDeclinationDeg(lat, lon);
    let source: "noaa" | "estimate" = "estimate";

    try {
      const noaa = new URL("https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination");
      noaa.searchParams.set("lat1", String(lat));
      noaa.searchParams.set("lon1", String(lon));
      noaa.searchParams.set("model", "WMM");
      noaa.searchParams.set("startYear", year);
      noaa.searchParams.set("resultFormat", "json");

      const res = await fetch(noaa, { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } });
      if (res.ok) {
        const json = (await res.json()) as { declination?: number; result?: Array<{ declination?: number }> };
        const d = json.declination ?? json.result?.[0]?.declination;
        if (typeof d === "number" && Number.isFinite(d)) {
          declinationDeg = d;
          source = "noaa";
        }
      }
    } catch {
      /* use estimate */
    }

    return NextResponse.json({ declinationDeg, source, lat, lon });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
