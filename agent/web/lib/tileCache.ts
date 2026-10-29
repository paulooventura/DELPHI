/**
 * Map pieces the reader has already looked at (OpenFreeMap style, tiles, sprites, glyphs), kept on the
 * device so the same view still draws offline (T341 / T350). Network first; the copy is only used when
 * the network fails. Capped at TILE_CACHE_MAX_BYTES: the least recently used entries go first.
 */

export const TILE_CACHE_MAX_BYTES = 60 * 1024 * 1024;
export const TILE_CACHE_PROTOCOL = "pmc";
const CACHED_HOSTS = ["tiles.openfreemap.org"];

const DB = "pm-map-tiles";
const STORE = "tiles";

type Entry = { url: string; data: ArrayBuffer; size: number; at: number };

/** Routes OpenFreeMap requests through the caching protocol; everything else is left alone. */
export function cacheableUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && CACHED_HOSTS.includes(u.host) ? `${TILE_CACHE_PROTOCOL}://${url}` : null;
  } catch {
    return null;
  }
}

export function stripProtocol(url: string): string {
  const p = `${TILE_CACHE_PROTOCOL}://`;
  return url.startsWith(p) ? url.slice(p.length) : url;
}

/** Oldest-first entries to drop so the total fits under the cap. Pure, for tests. */
export function evictionPlan(entries: Array<{ url: string; size: number; at: number }>, maxBytes = TILE_CACHE_MAX_BYTES): string[] {
  let total = entries.reduce((n, e) => n + e.size, 0);
  const drop: string[] = [];
  for (const e of [...entries].sort((a, b) => a.at - b.at)) {
    if (total <= maxBytes) break;
    drop.push(e.url);
    total -= e.size;
  }
  return drop;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "url" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function getEntry(url: string): Promise<Entry | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(url);
      req.onsuccess = () => resolve((req.result as Entry | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let writes = 0;
async function putEntry(url: string, data: ArrayBuffer): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ url, data, size: data.byteLength, at: Date.now() } satisfies Entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  if (++writes % 50 === 1) void trim(db);
}

/** Drops the least recently used entries once the store is over the cap. */
async function trim(db: IDBDatabase): Promise<void> {
  const meta: Array<{ url: string; size: number; at: number }> = [];
  await new Promise<void>(resolve => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve();
        const e = c.value as Entry;
        meta.push({ url: e.url, size: e.size, at: e.at });
        c.continue();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  const drop = evictionPlan(meta);
  if (!drop.length) return;
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    for (const url of drop) store.delete(url);
  } catch {
    /* next trim */
  }
}

function decode(data: ArrayBuffer, type: string | undefined): unknown {
  if (type === "json") return JSON.parse(new TextDecoder().decode(data));
  if (type === "string") return new TextDecoder().decode(data);
  return data;
}

/** MapLibre protocol handler: network first, saved copy when offline. */
export async function cachedTileLoad(
  params: { url: string; type?: "string" | "json" | "arrayBuffer" | "image" },
  abort: AbortController,
): Promise<{ data: unknown }> {
  const url = stripProtocol(params.url);
  try {
    const res = await fetch(url, { signal: abort.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    void putEntry(url, data);
    return { data: decode(data, params.type) };
  } catch (err) {
    if (abort.signal.aborted) throw err;
    const kept = await getEntry(url);
    if (!kept) throw err;
    void putEntry(url, kept.data);
    return { data: decode(kept.data, params.type) };
  }
}
