#!/usr/bin/env node
/**
 * Builds the orrery's static catalogs (public/orrery/*.json) from public-domain sources.
 * Runs at build/dev time only; the app never calls these services.
 *
 *   node scripts/build-orrery-catalog.mjs            # everything
 *   node scripts/build-orrery-catalog.mjs stars      # one layer
 *
 * Sources: JPL SSD Small-Body Database (sbdb.api, sbdb_query.api), JPL Horizons
 * (osculating elements for moons, state vectors for spacecraft), Yale Bright Star
 * Catalogue 5th ed. (Hoffleit & Warren 1991, via tdc-www.harvard.edu).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "orrery");
/** Common epoch for the dust clouds: 2026-01-01.0 TDB. */
const CLOUD_EPOCH_JD = 2461041.5;
const GAUSS_DEG_PER_DAY = 0.9856076686;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, as = "json", tries = 4) {
  for (let k = 1; ; k++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "pneuma-mundi-orrery-catalog/1.0" } });
      if (!res.ok && res.status !== 300) throw new Error(`${res.status} ${url}`);
      if (as === "buffer") return Buffer.from(await res.arrayBuffer());
      return as === "json" ? await res.json() : await res.text();
    } catch (err) {
      if (k >= tries) throw err;
      await sleep(1500 * k);
    }
  }
}

const round = (n, d) => (n == null || !Number.isFinite(n) ? null : Number(n.toFixed(d)));
const num = v => (v == null || v === "" ? null : Number(v));

async function writeJson(name, data) {
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.json`);
  const text = JSON.stringify(data);
  await writeFile(file, text);
  console.log(`wrote ${name}.json  ${(text.length / 1024).toFixed(0)} KB`);
}

/* ── Named small bodies (SBDB) ───────────────────────────────────── */

const DWARFS = [
  ["eris", "136199", "Eris"],
  ["haumea", "136108", "Haumea"],
  ["makemake", "136472", "Makemake"],
  ["sedna", "90377", "Sedna"],
  ["gonggong", "225088", "Gonggong"],
  ["quaoar", "50000", "Quaoar"],
  ["orcus", "90482", "Orcus"],
];

const NOTABLE_ASTEROIDS = [
  ["apophis", "99942", "Apophis"],
  ["bennu", "101955", "Bennu"],
  ["eros", "433", "Eros"],
  ["ryugu", "162173", "Ryugu"],
  ["itokawa", "25143", "Itokawa"],
  ["didymos", "65803", "Didymos"],
  ["psyche", "16", "Psyche"],
  ["hygiea", "10", "Hygiea"],
  ["dinkinesh", "152830", "Dinkinesh"],
  ["donaldjohanson", "52246", "Donaldjohanson"],
  ["eurybates", "3548", "Eurybates"],
  ["polymele", "15094", "Polymele"],
  ["leucus", "11351", "Leucus"],
  ["orus", "21900", "Orus"],
  ["patroclus", "617", "Patroclus"],
  ["arrokoth", "486958", "Arrokoth"],
];

const COMETS = [
  ["encke", "2P", "Encke"],
  ["tempel1", "9P", "Tempel 1"],
  ["swifttuttle", "109P", "Swift–Tuttle"],
  ["tempeltuttle", "55P", "Tempel–Tuttle"],
  ["halebopp", "C/1995 O1", "Hale–Bopp"],
  ["hyakutake", "C/1996 B2", "Hyakutake"],
  ["churyumov", "67P", "67P/Churyumov–Gerasimenko"],
  ["borrelly", "19P", "Borrelly"],
  ["wild2", "81P", "Wild 2"],
  ["giacobini", "21P", "Giacobini–Zinner"],
  ["biela", "3D", "Biela"],
  ["ikeyaseki", "C/1965 S1-A", "Ikeya–Seki"],
  ["neowise", "C/2020 F3", "NEOWISE"],
  ["ponsbrooks", "12P", "Pons–Brooks"],
  ["wirtanen", "46P", "Wirtanen"],
  ["hartley2", "103P", "Hartley 2"],
  ["sw1", "29P", "Schwassmann–Wachmann 1"],
  ["holmes", "17P", "Holmes"],
  ["sw3", "73P-C", "Schwassmann–Wachmann 3-C"],
  ["tuttle", "8P", "Tuttle"],
  ["olbers", "13P", "Olbers"],
  ["crommelin", "27P", "Crommelin"],
  ["ikeyazhang", "153P", "Ikeya–Zhang"],
  ["mcnaught", "C/2006 P1", "McNaught"],
  ["lovejoy", "C/2011 W3", "Lovejoy"],
  ["sidingspring", "C/2013 A1", "Siding Spring"],
  ["tsuchinshan", "C/2023 A3", "Tsuchinshan–ATLAS"],
  ["ponswinnecke", "7P", "Pons–Winnecke"],
  ["griggskjellerup", "26P", "Grigg–Skjellerup"],
  ["machholz", "96P", "Machholz 1"],
  ["honda", "45P", "Honda–Mrkos–Pajdušáková"],
  ["tgk", "41P", "Tuttle–Giacobini–Kresák"],
  ["brorsenmetcalf", "23P", "Brorsen–Metcalf"],
  ["oumuamua", "1I", "ʻOumuamua"],
  ["borisov", "2I", "Borisov"],
];

function sbdbField(list, name) {
  const f = (list ?? []).find(x => x.name === name);
  return f ? num(f.value) : null;
}

async function sbdbBody(id, sstr, name, kind) {
  let j = await get(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(sstr)}&phys-par=1&full-prec=1`);
  if (!j.orbit && j.list?.length) {
    j = await get(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(j.list[0].pdes)}&phys-par=1&full-prec=1`);
  }
  if (!j.orbit) throw new Error(`SBDB: no orbit for ${sstr}: ${JSON.stringify(j).slice(0, 200)}`);
  const el = j.orbit.elements;
  const e = sbdbField(el, "e");
  const q = sbdbField(el, "q");
  const tp = sbdbField(el, "tp");
  const phys = j.phys_par;
  return {
    id,
    name,
    kind,
    des: j.object?.fullname ?? sstr,
    el: {
      epoch: num(j.orbit.epoch),
      e,
      q,
      i: sbdbField(el, "i"),
      om: sbdbField(el, "om"),
      w: sbdbField(el, "w"),
      tp,
    },
    H: sbdbField(phys, "H"),
    G: sbdbField(phys, "G"),
    M1: sbdbField(phys, "M1"),
    K1: sbdbField(phys, "K1"),
    diameterKm: sbdbField(phys, "diameter"),
    gm: sbdbField(phys, "GM"),
  };
}

async function buildBodies() {
  const out = [];
  const jobs = [
    ...DWARFS.map(d => [...d, "dwarf"]),
    ...NOTABLE_ASTEROIDS.map(d => [...d, "asteroid"]),
    ...COMETS.map(d => [...d, "comet"]),
  ];
  for (const [id, sstr, name, kind] of jobs) {
    try {
      out.push(await sbdbBody(id, sstr, name, kind));
      process.stdout.write(".");
    } catch (err) {
      console.warn(`\nskip ${name}: ${err.message}`);
    }
    await sleep(120);
  }
  console.log();
  return out;
}

/* ── Moons (Horizons osculating elements relative to the planet) ── */

const MOONS = [
  ["phobos", 401, "Phobos", "mars", 22.5, 1.0659e16],
  ["deimos", 402, "Deimos", "mars", 12.4, 1.4762e15],
  ["amalthea", 505, "Amalthea", "jupiter", 167, 2.08e18],
  ["himalia", 506, "Himalia", "jupiter", 139.6, 4.2e18],
  ["mimas", 601, "Mimas", "saturn", 396.4, 3.75e19],
  ["enceladus", 602, "Enceladus", "saturn", 504.2, 1.08e20],
  ["tethys", 603, "Tethys", "saturn", 1062.2, 6.17e20],
  ["dione", 604, "Dione", "saturn", 1122.8, 1.095e21],
  ["rhea", 605, "Rhea", "saturn", 1527.6, 2.307e21],
  ["titan", 606, "Titan", "saturn", 5149.5, 1.3452e23],
  ["hyperion", 607, "Hyperion", "saturn", 270, 5.6e18],
  ["iapetus", 608, "Iapetus", "saturn", 1468.6, 1.806e21],
  ["phoebe", 609, "Phoebe", "saturn", 213, 8.3e18],
  ["ariel", 701, "Ariel", "uranus", 1157.8, 1.25e21],
  ["umbriel", 702, "Umbriel", "uranus", 1169.4, 1.27e21],
  ["titania", 703, "Titania", "uranus", 1576.8, 3.4e21],
  ["oberon", 704, "Oberon", "uranus", 1522.8, 3.08e21],
  ["miranda", 705, "Miranda", "uranus", 471.6, 6.4e19],
  ["triton", 801, "Triton", "neptune", 2706.8, 2.14e22],
  ["nereid", 802, "Nereid", "neptune", 357, 3.1e19],
  ["charon", 901, "Charon", "pluto", 1212, 1.586e21],
];
const PLANET_CENTER = { mars: 499, jupiter: 599, saturn: 699, uranus: 799, neptune: 899, pluto: 999 };

function horizonsUrl(params) {
  const q = Object.entries({ format: "json", OBJ_DATA: "NO", MAKE_EPHEM: "YES", CSV_FORMAT: "YES", ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(typeof v === "string" && k !== "format" && k !== "CSV_FORMAT" && k !== "OBJ_DATA" && k !== "MAKE_EPHEM" ? `'${v}'` : v)}`)
    .join("&");
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${q}`;
}

function soeRows(result) {
  const a = result.indexOf("$$SOE");
  const b = result.indexOf("$$EOE");
  if (a < 0 || b < 0) return [];
  return result
    .slice(a + 5, b)
    .trim()
    .split("\n")
    .map(l => l.split(",").map(s => s.trim()));
}

async function buildMoons() {
  const out = [];
  for (const [id, code, name, parent, diameterKm, massKg] of MOONS) {
    const j = await get(
      horizonsUrl({
        COMMAND: String(code),
        EPHEM_TYPE: "ELEMENTS",
        CENTER: `500@${PLANET_CENTER[parent]}`,
        START_TIME: "2026-11-01",
        STOP_TIME: "2026-11-02",
        STEP_SIZE: "1d",
        REF_PLANE: "ECLIPTIC",
        REF_SYSTEM: "ICRF",
        OUT_UNITS: "AU-D",
      }),
    );
    if (j.error) {
      console.warn(`skip ${name}: ${j.error}`);
      continue;
    }
    // JDTDB, Cal, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
    const r = soeRows(j.result)[0];
    if (!r) {
      console.warn(`skip ${name}: no rows`);
      continue;
    }
    out.push({
      id,
      name,
      kind: "moon",
      parent,
      el: {
        epoch: Number(r[0]),
        e: Number(r[2]),
        i: Number(r[4]),
        om: Number(r[5]),
        w: Number(r[6]),
        n: Number(r[8]),
        ma: Number(r[9]),
        a: Number(r[11]),
      },
      diameterKm,
      massKg,
    });
    process.stdout.write(".");
    await sleep(150);
  }
  console.log();
  return out;
}

/* ── Spacecraft (Horizons heliocentric vectors, ecliptic J2000) ──── */

const CRAFT = [
  ["voyager1", -31, "Voyager 1", 1977],
  ["voyager2", -32, "Voyager 2", 1977],
  ["newhorizons", -98, "New Horizons", 2006],
  ["pioneer10", -23, "Pioneer 10", 1972],
  ["pioneer11", -24, "Pioneer 11", 1973],
];

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function horizonsDate(msg, word) {
  const m = msg.match(new RegExp(`${word} A\\.D\\. (\\d{4})-([A-Z]{3})-(\\d{2})`));
  return m ? new Date(Date.UTC(Number(m[1]), MONTHS[m[2]], Number(m[3]))) : null;
}
const iso = d => d.toISOString().slice(0, 10);

async function craftVectors(code, start, stop, step) {
  for (let k = 0; k < 4; k++) {
    const j = await get(
      horizonsUrl({
        COMMAND: String(code),
        EPHEM_TYPE: "VECTORS",
        CENTER: "500@10",
        START_TIME: iso(start),
        STOP_TIME: iso(stop),
        STEP_SIZE: step,
        REF_PLANE: "ECLIPTIC",
        REF_SYSTEM: "ICRF",
        OUT_UNITS: "AU-D",
        VEC_TABLE: "1",
      }),
    );
    if (j.error) {
      const before = horizonsDate(j.error, "prior to");
      const after = horizonsDate(j.error, "after");
      if (before) start = new Date(before.getTime() + 2 * 86400000);
      else if (after) stop = new Date(after.getTime() - 2 * 86400000);
      else throw new Error(j.error);
      continue;
    }
    // JDTDB, Cal, X, Y, Z
    return soeRows(j.result).map(r => [Number(r[0]), Number(r[2]), Number(r[3]), Number(r[4])]);
  }
  throw new Error(`Horizons span search failed for ${code}`);
}

async function buildSpacecraft() {
  const out = [];
  for (const [id, code, name, launch] of CRAFT) {
    const dense = await craftVectors(code, new Date(Date.UTC(launch, 0, 1)), new Date(Date.UTC(launch + 13, 0, 1)), "10d");
    const sparse = await craftVectors(code, new Date(Date.UTC(launch + 13, 0, 1)), new Date(Date.UTC(2100, 0, 1)), "120d");
    const rows = [...dense, ...sparse.filter(r => r[0] > (dense.at(-1)?.[0] ?? 0))];
    out.push({
      id,
      name,
      kind: "spacecraft",
      launch,
      rows: rows.flatMap(r => [round(r[0], 1), round(r[1], 5), round(r[2], 5), round(r[3], 5)]),
    });
    console.log(`${name}: ${rows.length} samples ${rows[0]?.[0]} → ${rows.at(-1)?.[0]}`);
  }
  return out;
}

/* ── Dust clouds (SBDB query) ─────────────────────────────────────── */

async function cloud(params, limit, aMin, aMax, cap) {
  const fields = "full_name,epoch,e,a,i,om,w,ma,H";
  const j = await get(
    `https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=${fields}&sort=H&limit=${limit}&full-prec=true&${params}`,
  );
  const rows = [];
  for (const d of j.data ?? []) {
    const [, epoch, e, a, i, om, w, ma, H] = d.map(num);
    if (!(a > aMin && a < aMax) || !(e >= 0) || e >= 0.98 || ma == null) continue;
    if (rows.length / 7 >= cap) break;
    const n = GAUSS_DEG_PER_DAY / a ** 1.5;
    const M = (((ma + n * (CLOUD_EPOCH_JD - epoch)) % 360) + 360) % 360;
    rows.push(
      Math.round(a * 1e4),
      Math.round(e * 1e4),
      Math.round(i * 100),
      Math.round(om * 100),
      Math.round(w * 100),
      Math.round(M * 100),
      Math.round((H ?? 20) * 10),
    );
  }
  return rows;
}

/* ── Stars (Yale BSC5) ────────────────────────────────────────────── */

const PROPER = {
  "Alp CMa": "Sirius", "Alp Car": "Canopus", "Alp Boo": "Arcturus", "Alp Lyr": "Vega", "Alp Aur": "Capella",
  "Bet Ori": "Rigel", "Alp CMi": "Procyon", "Alp Ori": "Betelgeuse", "Alp Eri": "Achernar", "Bet Cen": "Hadar",
  "Alp Aql": "Altair", "Alp Tau": "Aldebaran", "Alp Vir": "Spica", "Alp Sco": "Antares", "Bet Gem": "Pollux",
  "Alp PsA": "Fomalhaut", "Alp Cyg": "Deneb", "Bet Cru": "Mimosa", "Alp Leo": "Regulus", "Eps CMa": "Adhara",
  "Alp Gem": "Castor", "Gam Cru": "Gacrux", "Lam Sco": "Shaula", "Gam Ori": "Bellatrix", "Bet Tau": "Elnath",
  "Bet Car": "Miaplacidus", "Eps Ori": "Alnilam", "Zet Ori": "Alnitak", "Alp Gru": "Alnair", "Eps UMa": "Alioth",
  "Alp Per": "Mirfak", "Alp UMa": "Dubhe", "Eta UMa": "Alkaid", "Del CMa": "Wezen", "Eps Sgr": "Kaus Australis",
  "Bet Aur": "Menkalinan", "Alp TrA": "Atria", "Gam Gem": "Alhena", "Alp Pav": "Peacock", "Alp Hya": "Alphard",
  "Alp Ari": "Hamal", "Alp UMi": "Polaris", "Bet UMi": "Kochab", "Alp And": "Alpheratz", "Bet And": "Mirach",
  "Alp Cas": "Schedar", "Bet Cas": "Caph", "Bet Leo": "Denebola", "Alp Oph": "Rasalhague", "Kap Ori": "Saiph",
  "Del Ori": "Mintaka", "Bet Per": "Algol", "Zet UMa": "Mizar", "Gam Leo": "Algieba", "Alp CrB": "Alphecca",
  "Gam Dra": "Eltanin", "Alp Peg": "Markab", "Bet Peg": "Scheat", "Eps Peg": "Enif", "Alp Cen": "Rigil Kentaurus",
  "Alp Cru": "Acrux", "Bet UMa": "Merak", "Gam UMa": "Phecda", "Del UMa": "Megrez", "Alp Lib": "Zubenelgenubi",
  "Bet Lib": "Zubeneschamali", "Alp Ser": "Unukalhai", "Bet Ori A": "Rigel", "Eta Tau": "Alcyone",
};

function parseBsc(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (line.length < 110) continue;
    const vmag = num(line.slice(102, 107).trim());
    const rah = num(line.slice(75, 77).trim());
    if (vmag == null || rah == null) continue;
    const ram = Number(line.slice(77, 79));
    const ras = Number(line.slice(79, 83));
    const sign = line[83] === "-" ? -1 : 1;
    const ded = Number(line.slice(84, 86));
    const dem = Number(line.slice(86, 88));
    const des = Number(line.slice(88, 90));
    const raDeg = (rah + ram / 60 + ras / 3600) * 15;
    const decDeg = sign * (ded + dem / 60 + des / 3600);
    const bayer = line.slice(7, 10).trim();
    const flam = line.slice(4, 7).trim();
    const con = line.slice(11, 14).trim();
    const plx = num(line.slice(161, 166).trim());
    const key = `${bayer} ${con}`;
    const name = PROPER[key] ?? (bayer ? key : flam ? `${flam} ${con}` : `HR ${line.slice(0, 4).trim()}`);
    const ly = plx && plx > 0.0005 ? 3.26156 / plx : 0;
    rows.push(round(raDeg, 3), round(decDeg, 3), round(vmag, 2), Math.round(ly), con, name);
  }
  return rows;
}

/* ── main ─────────────────────────────────────────────────────────── */

const want = new Set(process.argv.slice(2));
const on = k => want.size === 0 || want.has(k);

if (on("stars")) {
  const gz = await get("http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz", "buffer");
  const rows = parseBsc(gunzipSync(gz).toString("latin1"));
  await writeJson("stars", {
    source: "Yale Bright Star Catalogue, 5th rev. ed. (Hoffleit & Warren 1991)",
    fields: ["raDeg", "decDeg", "vmag", "distLy", "con", "name"],
    rows,
  });
}
if (on("bodies")) {
  await writeJson("bodies", {
    source: "JPL SSD Small-Body Database",
    bodies: await buildBodies(),
  });
}
if (on("moons")) {
  await writeJson("moons", {
    source: "JPL Horizons osculating elements (ecliptic J2000, planet-centred) at 2026-11-01; sizes and masses JPL planetary satellite physical parameters",
    moons: await buildMoons(),
  });
}
if (on("spacecraft")) {
  await writeJson("spacecraft", {
    source: "JPL Horizons heliocentric state vectors (ecliptic J2000)",
    fields: ["jdTdb", "xAu", "yAu", "zAu"],
    craft: await buildSpacecraft(),
  });
}
if (on("asteroids")) {
  await writeJson("asteroids", {
    source: "JPL SSD Small-Body Database, brightest numbered asteroids inside 6 AU by absolute magnitude",
    epochJd: CLOUD_EPOCH_JD,
    stride: 7,
    fields: ["a*1e4", "e*1e4", "i*100", "om*100", "w*100", "M*100", "H*10"],
    rows: await cloud("sb-kind=a&sb-ns=n", 21000, 0, 6, 20000),
  });
}
if (on("kuiper")) {
  await writeJson("kuiper", {
    source: "JPL SSD Small-Body Database, trans-Neptunian objects by absolute magnitude",
    epochJd: CLOUD_EPOCH_JD,
    stride: 7,
    fields: ["a*1e4", "e*1e4", "i*100", "om*100", "w*100", "M*100", "H*10"],
    rows: await cloud("sb-class=TNO", 5000, 30, 1e4, 5000),
  });
}
