/**
 * What the encrypted vault carries: only what the app needs to feel like
 * yours on another phone. Raw localStorage strings, so each store keeps
 * owning its own parsing/validation.
 */

export const VAULT_KEYS = [
  "delphi-birth-v1",
  "delphi-cast-embraced-v1",
  "pneuma-distill-v1",
  "delphi.worldCycles.v1",
] as const;

export type VaultPayload = {
  format: 1;
  savedAt: string;
  items: Partial<Record<(typeof VAULT_KEYS)[number], string>>;
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function collectPayload(store: Storage, now = new Date()): VaultPayload {
  const items: VaultPayload["items"] = {};
  for (const k of VAULT_KEYS) {
    const v = store.getItem(k);
    if (v) items[k] = v;
  }
  return { format: 1, savedAt: now.toISOString(), items };
}

/** Per item: primary wins when it has a value, else secondary fills the gap. */
export function mergePayloads(primary: VaultPayload, secondary: VaultPayload | null): VaultPayload {
  if (!secondary) return primary;
  const items: VaultPayload["items"] = { ...secondary.items };
  for (const k of VAULT_KEYS) {
    if (primary.items[k]) items[k] = primary.items[k];
  }
  return { format: 1, savedAt: primary.savedAt, items };
}

export function isPayload(v: unknown): v is VaultPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return p.format === 1 && !!p.items && typeof p.items === "object";
}

/**
 * Writes payload items to storage; returns true if anything changed.
 * `replace` also removes items the payload lacks (a wipe on another device).
 */
export function applyPayload(store: Storage, payload: VaultPayload, replace = false): boolean {
  let changed = false;
  for (const k of VAULT_KEYS) {
    const v = payload.items[k];
    if (v === undefined && replace && store.getItem(k) !== null) {
      store.removeItem(k);
      changed = true;
      continue;
    }
    if (typeof v !== "string" || v.length > 100_000) continue;
    if (store.getItem(k) !== v) {
      store.setItem(k, v);
      changed = true;
    }
  }
  return changed;
}

export function payloadEmpty(p: VaultPayload): boolean {
  return VAULT_KEYS.every((k) => !p.items[k]);
}
