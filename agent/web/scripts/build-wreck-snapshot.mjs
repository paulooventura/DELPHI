/**
 * Charted shipwrecks for the orrery world map, from NOAA ENC Direct (US nautical charts,
 * public domain): the general and coastal scale bands, merged and de-duplicated.
 * Writes public/earth/wrecks.json as compact rows.
 *
 *   node scripts/build-wreck-snapshot.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANDS = [
  ["general", 29],
  ["coastal", 33],
];
const CAT = { "dangerous wreck": 0, "non-dangerous wreck": 1, "distributed remains of wreck": 2, "wreck showing mast/masts": 3, "wreck showing any portion of hull or superstructure": 3 };

async function page(band, layer, offset) {
  const q = new URLSearchParams({
    where: "OBJECTID>0",
    outFields: "OBJECTID,CATWRK,OBJNAM,VALSOU,WATLEV,SORDAT",
    outSR: "4326",
    resultOffset: String(offset),
    resultRecordCount: "1000",
    f: "json",
  });
  const url = `https://encdirect.noaa.gov/arcgis/rest/services/encdirect/enc_${band}/MapServer/${layer}/query?${q}`;
  // The ENC Direct servers drop the odd request behind their load balancer; retry a few times.
  let last = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    const j = res.ok ? await res.json() : { error: { message: String(res.status) } };
    if (!j.error) return j.features ?? [];
    last = j.error.message;
    await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(`${band}: ${last}`);
}

const rows = [];
const seen = new Set();
for (const [band, layer] of BANDS) {
  let n = 0;
  for (let offset = 0; ; offset += 1000) {
    const feats = await page(band, layer, offset);
    for (const f of feats) {
      const { x, y } = f.geometry ?? {};
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const key = `${Math.round(x * 300)}_${Math.round(y * 300)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = f.attributes;
      const cat = (a.CATWRK ?? "").replace(/\s*\(test\)$/, "").toLowerCase();
      const depth = Number.isFinite(a.VALSOU) ? Math.round(a.VALSOU * 10) / 10 : null;
      const year = /^\d{4}/.test(a.SORDAT ?? "") ? Number(a.SORDAT.slice(0, 4)) : null;
      const name = (a.OBJNAM ?? "").trim();
      rows.push([Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4, CAT[cat] ?? 4, depth, a.WATLEV ?? null, name, year]);
      n++;
    }
    if (feats.length < 1000) break;
  }
  console.log(`${band}: ${n}`);
}

const out = join(root, "public", "earth", "wrecks.json");
mkdirSync(dirname(out), { recursive: true });
const body = {
  source: "NOAA ENC Direct (US nautical charts), general + coastal bands",
  fetchedAt: new Date().toISOString(),
  fields: ["lon", "lat", "cat", "depthM", "watlev", "name", "chartedYear"],
  cats: ["dangerous wreck", "non-dangerous wreck", "distributed remains", "hull or masts showing", "wreck"],
  rows,
};
writeFileSync(out, JSON.stringify(body));
console.log(`${rows.length} wrecks, ${(JSON.stringify(body).length / 1024).toFixed(0)} KB -> ${out}`);
