/**
 * Vault crypto — WebCrypto only, runs on the device.
 *
 * - Data key: random AES-GCM-256. Encrypts the vault JSON.
 * - Recovery key: 160 random bits shown to the user once (Crockford base32,
 *   8 groups of 4). HKDF(recovery, salt = user id) → key-encryption key that
 *   wraps the data key. Without the recovery key nobody — including Pneuma
 *   Mundi — can unwrap it.
 * - Each device keeps a non-extractable copy of the data key in IndexedDB.
 * - The user id is bound in as AES-GCM additional data, so a ciphertext can't
 *   be replayed into another account's vault.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RECOVERY_BYTES = 20;
const KEK_INFO = "pneuma-vault-kek-v1";
const enc = new TextEncoder();
const dec = new TextDecoder();

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("webcrypto-unavailable");
  return s;
}

function random(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function encodeRecovery(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g)!.join("-");
}

/** Forgiving parse: case, spaces, dashes, and O/I/L look-alikes are fine. */
export function parseRecovery(text: string): Uint8Array<ArrayBuffer> | null {
  const clean = text
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (clean.length !== Math.ceil((RECOVERY_BYTES * 8) / 5)) return null;
  const out = new Uint8Array(RECOVERY_BYTES);
  let bits = 0;
  let value = 0;
  let i = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out[i++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return i === RECOVERY_BYTES ? out : null;
}

export function newRecoveryKey(): { text: string; bytes: Uint8Array<ArrayBuffer> } {
  const bytes = random(RECOVERY_BYTES);
  return { text: encodeRecovery(bytes), bytes };
}

async function deriveKek(recovery: Uint8Array<ArrayBuffer>, userId: string): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", recovery, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(userId), info: enc.encode(KEK_INFO) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/** Fresh data key (extractable once, only so it can be wrapped). */
export function newDataKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]) as Promise<CryptoKey>;
}

export async function wrapDataKey(dataKey: CryptoKey, recovery: Uint8Array<ArrayBuffer>, userId: string): Promise<string> {
  const kek = await deriveKek(recovery, userId);
  const iv = random(12);
  const wrapped = new Uint8Array(
    await subtle().wrapKey("raw", dataKey, kek, { name: "AES-GCM", iv, additionalData: enc.encode(userId) }),
  );
  const out = new Uint8Array(iv.length + wrapped.length);
  out.set(iv);
  out.set(wrapped, iv.length);
  return toB64(out);
}

/** Throws on a wrong recovery key (GCM authentication fails). */
export async function unwrapDataKey(wrappedB64: string, recovery: Uint8Array<ArrayBuffer>, userId: string): Promise<CryptoKey> {
  const kek = await deriveKek(recovery, userId);
  const raw = fromB64(wrappedB64);
  return subtle().unwrapKey(
    "raw",
    raw.slice(12),
    kek,
    { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: enc.encode(userId) },
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Same key, but non-extractable — what each device stores. */
export async function lockDown(dataKey: CryptoKey): Promise<CryptoKey> {
  const raw = await subtle().exportKey("raw", dataKey);
  return subtle().importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptJson(key: CryptoKey, userId: string, value: unknown): Promise<{ ciphertext: string; iv: string }> {
  const iv = random(12);
  const data = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(`${userId}:vault`) },
      key,
      enc.encode(JSON.stringify(value)),
    ),
  );
  return { ciphertext: toB64(data), iv: toB64(iv) };
}

export async function decryptJson<T>(key: CryptoKey, userId: string, ciphertext: string, iv: string): Promise<T> {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: fromB64(iv), additionalData: enc.encode(`${userId}:vault`) },
    key,
    fromB64(ciphertext),
  );
  return JSON.parse(dec.decode(plain)) as T;
}
