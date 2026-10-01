/** Per-device data key, stored as a non-extractable CryptoKey in IndexedDB. */

const DB = "pm-vault";
const STORE = "keys";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result as T);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function loadDeviceKey(userId: string): Promise<CryptoKey | null> {
  try {
    const k = await run<CryptoKey | undefined>("readonly", (s) => s.get(userId));
    return k ?? null;
  } catch {
    return null;
  }
}

export function saveDeviceKey(userId: string, key: CryptoKey): Promise<unknown> {
  return run("readwrite", (s) => s.put(key, userId));
}

export function forgetDeviceKeys(): Promise<unknown> {
  return run("readwrite", (s) => s.clear()).catch(() => undefined);
}
