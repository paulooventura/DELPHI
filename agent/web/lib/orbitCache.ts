/**
 * The last orbit sets this device downloaded, kept in IndexedDB so the orrery's satellites
 * still show with no network. Works in the satellite worker too. Every call fails soft.
 */
import type { OrbitSet } from "./orbitRows";

const DB = "pm-orbits";
const STORE = "sets";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedOrbitSet(group: string): Promise<OrbitSet | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(group);
      req.onsuccess = () => resolve((req.result as OrbitSet | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCachedOrbitSet(group: string, set: OrbitSet): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(set, group);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
