/**
 * Seafloor relief tiles for the world map: GEBCO's public shaded-relief WMS, one 256 px JPEG
 * per web-mercator tile, cached by the CDN for a month so GEBCO renders each tile once.
 */
const HALF = 20037508.342789244;
const MAX_Z = 8;

export async function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const p = await params;
  const z = Number(p.z);
  const x = Number(p.x);
  const y = Number(p.y.replace(/\.jpe?g$/, ""));
  const n = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > MAX_Z || x < 0 || y < 0 || x >= n || y >= n) {
    return new Response("bad tile", { status: 400 });
  }
  const size = (2 * HALF) / n;
  const bbox = [-HALF + x * size, HALF - (y + 1) * size, -HALF + (x + 1) * size, HALF - y * size].map(v => v.toFixed(2)).join(",");
  const url =
    "https://wms.gebco.net/mapserv?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=GEBCO_LATEST_2&STYLES=" +
    `&CRS=EPSG:3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(String(res.status));
    return new Response(await res.arrayBuffer(), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable" },
    });
  } catch {
    return new Response("relief unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
