#!/usr/bin/env node
/**
 * Bakes ancient coastlines for the Earth view's Ages slider (Paulo, Nov 10: Pangea and all that).
 *
 * Source: the GPlates Web Service (EarthByte, University of Sydney), plate model Müller et al. 2019,
 * "A global plate model including lithospheric deformation along major rifts and orogens since the
 * Triassic" (Tectonics 38), CC BY 4.0. Asked once here, at build time; the app ships the files and
 * makes no live calls.
 *
 * Output: public/earth/paleo/muller2019/<Ma>.json (simplified GeoJSON polygons) + index.json.
 * Run: node scripts/build-paleo-coastlines.mjs [--step 10] [--max 250]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "public", "earth", "paleo", "muller2019");
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const STEP = arg("--step", 10);
const MAX = arg("--max", 250);
const TOL = 0.12; // degrees: Douglas-Peucker tolerance
const MIN_AREA = 0.25; // square degrees: smaller islands are dropped

function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  if (!L) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let best = -1, bi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([s, bi], [bi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}
const r2 = n => Math.round(n * 100) / 100;

function cleanRing(ring) {
  const pts = simplify(ring.map(([x, y]) => [r2(x), r2(y)]), TOL);
  const out = [];
  for (const p of pts) if (!out.length || out[out.length - 1][0] !== p[0] || out[out.length - 1][1] !== p[1]) out.push(p);
  if (out.length < 4) return null;
  const f = out[0], l = out[out.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) out.push([f[0], f[1]]);
  return out;
}

async function frame(ma) {
  const url = `https://gws.gplates.org/reconstruct/coastlines/?time=${ma}&model=MULLER2019`;
  let lastErr;
  for (let k = 0; k < 3; k++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "pneuma-build/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const feats = [];
      for (const f of j.features ?? []) {
        const g = f.geometry;
        const polys = g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
        for (const poly of polys) {
          const outer = poly[0] && cleanRing(poly[0]);
          if (!outer || area(outer) < MIN_AREA) continue;
          const holes = poly.slice(1).map(cleanRing).filter(h => h && area(h) >= MIN_AREA);
          feats.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [outer, ...holes] } });
        }
      }
      return { type: "FeatureCollection", features: feats };
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (k + 1)));
    }
  }
  throw new Error(`${ma} Ma: ${lastErr}`);
}

await mkdir(OUT, { recursive: true });
const frames = [];
let total = 0;
for (let ma = 0; ma <= MAX; ma += STEP) {
  const fc = await frame(ma);
  const body = JSON.stringify(fc);
  await writeFile(path.join(OUT, `${ma}.json`), body);
  frames.push(ma);
  total += body.length;
  console.log(`${String(ma).padStart(3)} Ma  ${fc.features.length} polygons  ${(body.length / 1024).toFixed(0)} KB`);
}
await writeFile(
  path.join(OUT, "index.json"),
  JSON.stringify(
    {
      model: "Müller et al. 2019",
      cite: "Müller, R.D. et al. (2019), A global plate model including lithospheric deformation along major rifts and orogens since the Triassic, Tectonics 38. Reconstructed with the GPlates Web Service (EarthByte).",
      license: "CC BY 4.0",
      builtAt: new Date().toISOString(),
      stepMa: STEP,
      frames,
    },
    null,
    1,
  ),
);
console.log(`done: ${frames.length} frames, ${(total / 1024 / 1024).toFixed(2)} MB`);
