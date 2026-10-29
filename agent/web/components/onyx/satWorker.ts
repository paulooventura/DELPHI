/**
 * SGP4 off the main thread for the orrery's Earth level. Loads the orbit groups
 * (our cached route first, the bundled snapshot second), then answers "tick"
 * with TEME positions (km) and velocities (km/s) for every object at time t.
 */
import { json2satrec, propagate, type SatRec } from "../../lib/sgp4";
import { rowToOmm, type GpRow, type OrbitSet } from "../../lib/orbitRows";
import { apiUrl } from "../../lib/apiBase";

export type SatWorkerIn =
  | { type: "init"; groups: string[] }
  | { type: "tick"; t: number }
  | { type: "path"; i: number; t: number; n: number };

export type SatWorkerOut =
  | { type: "meta"; sets: Array<{ group: string; source: string; fetchedAt: string; start: number; count: number }>; rows: GpRow[] }
  | { type: "state"; t: number; pos: Float32Array; vel: Float32Array; ms: number }
  | { type: "path"; i: number; pts: Float32Array };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<SatWorkerIn>) => void) | null;
  postMessage: (msg: SatWorkerOut, transfer?: Transferable[]) => void;
};
let recs: Array<SatRec | null> = [];
let rows: GpRow[] = [];

async function loadGroup(group: string): Promise<(OrbitSet & { fallback: boolean }) | null> {
  for (const [url, fallback] of [
    [apiUrl(`/api/orbits/${group}`), false],
    [`/orbits/${group}.json`, true],
  ] as const) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const j = (await res.json()) as OrbitSet;
      if (j && Array.isArray(j.rows) && j.rows.length) return { ...j, fallback };
    } catch {
      /* next source */
    }
  }
  return null;
}

function stateAt(rec: SatRec | null, date: Date) {
  if (!rec) return null;
  try {
    const pv = propagate(rec, date);
    if (!pv || typeof pv.position !== "object" || typeof pv.velocity !== "object") return null;
    return pv;
  } catch {
    return null;
  }
}

ctx.onmessage = async (e: MessageEvent<SatWorkerIn>) => {
  const msg = e.data;
  if (msg.type === "init") {
    const sets = await Promise.all(msg.groups.map(loadGroup));
    const meta: Array<{ group: string; source: string; fetchedAt: string; start: number; count: number }> = [];
    rows = [];
    recs = [];
    sets.forEach((s, k) => {
      if (!s) return;
      meta.push({
        group: msg.groups[k]!,
        source: s.fallback ? `${s.source} · bundled snapshot` : s.source,
        fetchedAt: s.fetchedAt,
        start: rows.length,
        count: s.rows.length,
      });
      for (const r of s.rows) {
        rows.push(r);
        try {
          recs.push(json2satrec(rowToOmm(r) as never));
        } catch {
          recs.push(null);
        }
      }
    });
    const out: SatWorkerOut = { type: "meta", sets: meta, rows };
    ctx.postMessage(out);
    return;
  }
  if (msg.type === "tick") {
    const t0 = performance.now();
    const n = recs.length;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const date = new Date(msg.t);
    for (let i = 0; i < n; i++) {
      const pv = stateAt(recs[i]!, date);
      if (!pv) continue;
      const p = pv.position as { x: number; y: number; z: number };
      const v = pv.velocity as { x: number; y: number; z: number };
      if (!Number.isFinite(p.x) || p.x * p.x + p.y * p.y + p.z * p.z < 6000 * 6000) continue;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      vel[i * 3] = v.x;
      vel[i * 3 + 1] = v.y;
      vel[i * 3 + 2] = v.z;
    }
    const out: SatWorkerOut = { type: "state", t: msg.t, pos, vel, ms: performance.now() - t0 };
    ctx.postMessage(out, [pos.buffer, vel.buffer]);
    return;
  }
  if (msg.type === "path") {
    const rec = recs[msg.i];
    const row = rows[msg.i];
    if (!rec || !row) return;
    const periodMs = (1440 / row[4]) * 60_000;
    const pts = new Float32Array((msg.n + 1) * 3);
    for (let k = 0; k <= msg.n; k++) {
      const pv = stateAt(rec, new Date(msg.t + (k / msg.n) * periodMs));
      if (!pv) continue;
      const p = pv.position as { x: number; y: number; z: number };
      pts[k * 3] = p.x;
      pts[k * 3 + 1] = p.y;
      pts[k * 3 + 2] = p.z;
    }
    const out: SatWorkerOut = { type: "path", i: msg.i, pts };
    ctx.postMessage(out, [pts.buffer]);
  }
};
