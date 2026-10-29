#!/usr/bin/env node
/**
 * Offline base map for the Earth level (T341): Natural Earth (public domain) land, land borders and
 * major cities, trimmed to geometry + names with 3-decimal coordinates (~100 m, plenty for zooms 1-6).
 *
 *   node scripts/build-offline-map.mjs <folder with ne_50m_land.geojson,
 *     ne_50m_admin_0_boundary_lines_land.geojson, ne_110m_populated_places_simple.geojson>
 *
 * Source: https://github.com/nvkelso/natural-earth-vector (geojson/). Writes public/earth/offline/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-offline-map.mjs <natural-earth geojson folder>");
  process.exit(1);
}
const out = path.join(web, "public", "earth", "offline");
fs.mkdirSync(out, { recursive: true });

const round = (v) => (Array.isArray(v) ? v.map(round) : Math.round(v * 1000) / 1000);

/** Drop consecutive duplicate points created by rounding. */
function dedupe(coords) {
  if (!Array.isArray(coords[0])) return coords;
  if (typeof coords[0][0] === "number") {
    return coords.filter((p, i) => i === 0 || p[0] !== coords[i - 1][0] || p[1] !== coords[i - 1][1]);
  }
  return coords.map(dedupe);
}

function trim(file, keep) {
  const fc = JSON.parse(fs.readFileSync(path.join(src, file), "utf8"));
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      type: "Feature",
      properties: keep(f.properties ?? {}),
      geometry: { type: f.geometry.type, coordinates: dedupe(round(f.geometry.coordinates)) },
    })),
  };
}

const files = {
  "land.json": trim("ne_50m_land.geojson", () => ({})),
  "borders.json": trim("ne_50m_admin_0_boundary_lines_land.geojson", () => ({})),
  "cities.json": trim("ne_110m_populated_places_simple.geojson", (p) => ({ name: p.name, rank: p.scalerank })),
};
for (const [name, fc] of Object.entries(files)) {
  const body = JSON.stringify(fc);
  fs.writeFileSync(path.join(out, name), body);
  console.log(`${name} ${(body.length / 1024).toFixed(0)} KB, ${fc.features.length} features`);
}
