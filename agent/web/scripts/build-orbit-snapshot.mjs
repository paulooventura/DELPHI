#!/usr/bin/env node
/**
 * Build-time fallback data for the orrery's Earth level.
 *   public/orbits/<group>.json  compact CelesTrak GP rows (same shape as /api/orbits/<group>)
 *   public/orrery/earth-land.png  1024×512 equirectangular land mask (Natural Earth 110m, public domain)
 * Usage: node scripts/build-orbit-snapshot.mjs [--no-land]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GROUPS = ["active", "cosmos-1408-debris", "fengyun-1c-debris", "iridium-33-debris", "cosmos-2251-debris"];
const UA = "PneumaMundi-orrery/1.0 (+https://pauloventura.org)";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const n = (v) => (v == null || v === "" ? 0 : Number(v));
function compactOmm(list) {
  const out = [];
  for (const o of list) {
    const id = n(o.NORAD_CAT_ID);
    const mm = n(o.MEAN_MOTION);
    if (!id || !(mm > 0) || typeof o.EPOCH !== "string") continue;
    out.push([
      id,
      String(o.OBJECT_NAME ?? id).trim(),
      String(o.OBJECT_ID ?? ""),
      o.EPOCH,
      Number(mm.toFixed(8)),
      Number(n(o.ECCENTRICITY).toFixed(7)),
      Number(n(o.INCLINATION).toFixed(4)),
      Number(n(o.RA_OF_ASC_NODE).toFixed(4)),
      Number(n(o.ARG_OF_PERICENTER).toFixed(4)),
      Number(n(o.MEAN_ANOMALY).toFixed(4)),
      Number(n(o.BSTAR).toPrecision(5)),
      Number(n(o.MEAN_MOTION_DOT).toPrecision(5)),
      Number(n(o.MEAN_MOTION_DDOT).toPrecision(5)),
    ]);
  }
  return out;
}

async function snapshot(group) {
  const sources = [
    ["CelesTrak", `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`],
    ["CelesTrak via satvisor-data mirror", `https://raw.githubusercontent.com/satvisorcom/satvisor-data/master/celestrak/json/${group}.json`],
  ];
  for (const [source, url] of sources) {
    try {
      const list = await fetchJson(url);
      if (!Array.isArray(list) || !list.length) throw new Error("empty");
      const rows = compactOmm(list);
      const newest = rows.reduce((m, r) => (r[3] > m ? r[3] : m), "");
      const body = { group, source, fetchedAt: new Date(`${newest.endsWith("Z") ? newest : newest + "Z"}`).toISOString(), rows };
      const file = join(ROOT, "public", "orbits", `${group}.json`);
      mkdirSync(dirname(file), { recursive: true });
      const text = JSON.stringify(body);
      writeFileSync(file, text);
      console.log(`${group}: ${rows.length} rows, ${(text.length / 1024).toFixed(0)} KB (${source})`);
      return;
    } catch (err) {
      console.warn(`${group}: ${source} failed (${err.message})`);
    }
  }
  throw new Error(`${group}: no source`);
}

/* ---------- land mask ---------- */
const CRC = new Uint32Array(256).map((_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function grayPng(w, h, px) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    px.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function landMask() {
  const gj = await fetchJson("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson");
  const SS = 2;
  const W = 1024 * SS;
  const H = 512 * SS;
  const hi = new Uint8Array(W * H);
  const polys = [];
  for (const f of gj.features) {
    const g = f.geometry;
    if (g.type === "Polygon") polys.push(g.coordinates);
    else if (g.type === "MultiPolygon") polys.push(...g.coordinates);
  }
  for (const rings of polys) {
    const edges = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        edges.push([((x0 + 180) / 360) * W, ((90 - y0) / 180) * H, ((x1 + 180) / 360) * W, ((90 - y1) / 180) * H]);
      }
    }
    for (let y = 0; y < H; y++) {
      const sy = y + 0.5;
      const xs = [];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5));
        const b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = a; x <= b; x++) hi[y * W + x] ^= 1;
      }
    }
  }
  /* Antarctica's ring runs along -90°; fill the polar cap so the south pole reads as land. */
  for (let y = H - 2 * SS; y < H; y++) for (let x = 0; x < W; x++) hi[y * W + x] = 1;
  const w = W / SS;
  const h = H / SS;
  const px = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) s += hi[(y * SS + j) * W + x * SS + i];
      px[y * w + x] = Math.round((s / (SS * SS)) * 255);
    }
  const png = grayPng(w, h, px);
  const file = join(ROOT, "public", "orrery", "earth-land.png");
  writeFileSync(file, png);
  console.log(`earth-land.png: ${w}×${h}, ${(png.length / 1024).toFixed(0)} KB`);
}

for (const g of GROUPS) await snapshot(g);
if (!process.argv.includes("--no-land")) await landMask();
