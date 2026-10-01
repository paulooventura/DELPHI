/**
 * Encrypted backup + sync of the on-device stores.
 *
 * The server only ever receives ciphertext + a wrapped key. Plain birth data,
 * casts, and prefs stay in this browser. Concurrency: each push is an
 * optimistic update on `revision`; a conflict pulls, merges (this device
 * wins per item), and pushes again.
 */

import { LOCAL_CHANGE_EVENT } from "../localChange";
import {
  decryptJson,
  encryptJson,
  lockDown,
  newDataKey,
  newRecoveryKey,
  parseRecovery,
  unwrapDataKey,
  wrapDataKey,
} from "./crypto";
import { forgetDeviceKeys, loadDeviceKey, saveDeviceKey } from "./keystore";
import { applyPayload, collectPayload, isPayload, mergePayloads, payloadEmpty, type VaultPayload } from "./payload";
import { supabase } from "./supabase";

export const VAULT_APPLIED_EVENT = "pm-vault-applied";

export type VaultStatus =
  | { kind: "off" }
  | { kind: "signed-out" }
  | { kind: "no-vault"; email: string }
  | { kind: "locked"; email: string }
  | { kind: "ready"; email: string; syncedAt: string | null }
  | { kind: "error"; email?: string; message: string };

type VaultRow = { wrapped_key: string; ciphertext: string; iv: string; revision: number };

const DIRTY = "pm-vault-dirty";
const SYNCED_AT = "pm-vault-synced-at";
const revKey = (uid: string) => `pm-vault-rev:${uid}`;

function ls(): Storage {
  return window.localStorage;
}

async function session() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ? { sb, uid: data.session.user.id, email: data.session.user.email ?? "", token: data.session.access_token } : null;
}

async function fetchRow(uid: string): Promise<VaultRow | null> {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("vaults")
    .select("wrapped_key, ciphertext, iv, revision")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new Error("vault-read");
  return (data as VaultRow | null) ?? null;
}

function markSynced(uid: string, revision: number) {
  ls().setItem(revKey(uid), String(revision));
  ls().setItem(SYNCED_AT, new Date().toISOString());
  ls().removeItem(DIRTY);
}

async function decryptRow(key: CryptoKey, uid: string, row: VaultRow): Promise<VaultPayload> {
  const p = await decryptJson<unknown>(key, uid, row.ciphertext, row.iv);
  if (!isPayload(p)) throw new Error("vault-format");
  return p;
}

function announce(changed: boolean) {
  if (changed) window.dispatchEvent(new CustomEvent(VAULT_APPLIED_EVENT));
}

export async function vaultStatus(): Promise<VaultStatus> {
  if (!supabase()) return { kind: "off" };
  const s = await session();
  if (!s) return { kind: "signed-out" };
  try {
    const key = await loadDeviceKey(s.uid);
    const row = await fetchRow(s.uid);
    if (!row) return { kind: "no-vault", email: s.email };
    if (!key) return { kind: "locked", email: s.email };
    return { kind: "ready", email: s.email, syncedAt: ls().getItem(SYNCED_AT) };
  } catch {
    return { kind: "error", email: s.email, message: "Couldn't reach your backup. Check the connection." };
  }
}

export async function sendSignInCode(email: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Accounts aren't switched on yet.";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/?mode=you`, shouldCreateUser: true },
  });
  return error ? (error.status === 429 ? "Too many tries. Wait a minute." : "Couldn't send the email.") : null;
}

export async function verifySignInCode(email: string, code: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Accounts aren't switched on yet.";
  const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: "email" });
  return error ? "That code didn't work. Check it or send a new one." : null;
}

/**
 * Creates (or re-keys) the vault from this device's data. Returns the new
 * recovery key — shown once, never stored anywhere.
 */
export async function createVault(): Promise<string> {
  const s = await session();
  if (!s) throw new Error("signed-out");
  const recovery = newRecoveryKey();
  const dataKey = await newDataKey();
  const wrapped = await wrapDataKey(dataKey, recovery.bytes, s.uid);
  const deviceKey = await lockDown(dataKey);
  const existing = await fetchRow(s.uid);
  const revision = (existing?.revision ?? 0) + 1;
  const { ciphertext, iv } = await encryptJson(deviceKey, s.uid, collectPayload(ls()));
  const { error } = await s.sb
    .from("vaults")
    .upsert({ user_id: s.uid, wrapped_key: wrapped, ciphertext, iv, revision, updated_at: new Date().toISOString() });
  if (error) throw new Error("vault-write");
  await saveDeviceKey(s.uid, deviceKey);
  markSynced(s.uid, revision);
  return recovery.text;
}

/** New device: recovery key → device key, then bring the vault in. */
export async function unlockVault(recoveryText: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const s = await session();
  if (!s) return { ok: false, message: "Sign in first." };
  const bytes = parseRecovery(recoveryText);
  if (!bytes) return { ok: false, message: "That doesn't look like a recovery key (8 groups of 4)." };
  const row = await fetchRow(s.uid).catch(() => null);
  if (!row) return { ok: false, message: "No backup found for this account." };
  let key: CryptoKey;
  try {
    key = await unwrapDataKey(row.wrapped_key, bytes, s.uid);
  } catch {
    return { ok: false, message: "That recovery key doesn't open this backup." };
  }
  const remote = await decryptRow(key, s.uid, row);
  const local = collectPayload(ls());
  const merged = mergePayloads(remote, local);
  const changed = applyPayload(ls(), merged);
  await saveDeviceKey(s.uid, key);
  markSynced(s.uid, row.revision);
  if (!payloadEmpty(local) && JSON.stringify(merged.items) !== JSON.stringify(remote.items)) {
    ls().setItem(DIRTY, "1");
    await pushVault().catch(() => {});
  }
  announce(changed);
  return { ok: true };
}

export async function pushVault(): Promise<void> {
  const s = await session();
  if (!s) return;
  const key = await loadDeviceKey(s.uid);
  if (!key) return;
  const rev = Number(ls().getItem(revKey(s.uid)) || "0");
  const local = collectPayload(ls());
  const { ciphertext, iv } = await encryptJson(key, s.uid, local);
  const { data, error } = await s.sb
    .from("vaults")
    .update({ ciphertext, iv, revision: rev + 1, updated_at: new Date().toISOString() })
    .eq("user_id", s.uid)
    .eq("revision", rev)
    .select("revision");
  if (error) throw new Error("vault-write");
  if (data && data.length) {
    markSynced(s.uid, rev + 1);
    return;
  }
  // Another device wrote first: fold its items under ours and retry once.
  const row = await fetchRow(s.uid);
  if (!row) return;
  const remote = await decryptRow(key, s.uid, row);
  const merged = mergePayloads(local, remote);
  announce(applyPayload(ls(), merged));
  const again = await encryptJson(key, s.uid, merged);
  const retry = await s.sb
    .from("vaults")
    .update({ ...again, revision: row.revision + 1, updated_at: new Date().toISOString() })
    .eq("user_id", s.uid)
    .eq("revision", row.revision)
    .select("revision");
  if (retry.data && retry.data.length) markSynced(s.uid, row.revision + 1);
}

/** Pick up edits made on another device. */
export async function pullVault(): Promise<void> {
  const s = await session();
  if (!s) return;
  const key = await loadDeviceKey(s.uid);
  if (!key) return;
  if (ls().getItem(DIRTY)) return pushVault();
  const row = await fetchRow(s.uid);
  if (!row) return;
  const rev = Number(ls().getItem(revKey(s.uid)) || "0");
  if (row.revision <= rev) return;
  const remote = await decryptRow(key, s.uid, row);
  announce(applyPayload(ls(), remote, true));
  markSynced(s.uid, row.revision);
}

export async function signOutHere(): Promise<void> {
  const sb = supabase();
  await sb?.auth.signOut().catch(() => {});
  await forgetDeviceKeys();
  ls().removeItem(DIRTY);
  ls().removeItem(SYNCED_AT);
}

/** Deletes the account and its encrypted vault on the server. */
export async function deleteAccount(): Promise<string | null> {
  const s = await session();
  if (!s) return "Sign in first.";
  const res = await fetch("/api/account/delete", {
    method: "POST",
    headers: { Authorization: `Bearer ${s.token}` },
  }).catch(() => null);
  if (!res || !res.ok) return "Couldn't delete right now. Try again.";
  await signOutHere();
  return null;
}

let started = false;

/** Once per page: follow local writes up, and other devices' writes down. */
export function startVaultSync() {
  if (started || typeof window === "undefined" || !supabase()) return;
  started = true;
  let timer: number | undefined;
  window.addEventListener(LOCAL_CHANGE_EVENT, () => {
    ls().setItem(DIRTY, "1");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void pushVault().catch(() => {}), 2500);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void pullVault().catch(() => {});
  });
  void pullVault().catch(() => {});
}
