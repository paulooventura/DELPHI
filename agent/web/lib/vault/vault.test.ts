import { describe, expect, it } from "vitest";
import {
  decryptJson,
  encodeRecovery,
  encryptJson,
  lockDown,
  newDataKey,
  newRecoveryKey,
  parseRecovery,
  unwrapDataKey,
  wrapDataKey,
} from "./crypto";
import { applyPayload, collectPayload, mergePayloads, payloadEmpty } from "./payload";

const UID = "6f1c2a52-8f3e-4c1b-9b7a-2d4e5f60718a";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

describe("recovery key", () => {
  it("round-trips and tolerates sloppy typing", () => {
    const { text, bytes } = newRecoveryKey();
    expect(text).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(parseRecovery(text)).toEqual(bytes);
    const sloppy = text.toLowerCase().replace(/-/g, " ").replace(/0/g, "o").replace(/1/g, "l");
    expect(parseRecovery(sloppy)).toEqual(bytes);
  });

  it("rejects wrong lengths and characters", () => {
    expect(parseRecovery("ABCD-EFGH")).toBeNull();
    expect(parseRecovery("U".repeat(32))).toBeNull();
    expect(encodeRecovery(new Uint8Array(20)).replace(/-/g, "")).toBe("0".repeat(32));
  });
});

describe("vault crypto", () => {
  it("wraps, unwraps, encrypts and decrypts", async () => {
    const rec = newRecoveryKey();
    const dk = await newDataKey();
    const wrapped = await wrapDataKey(dk, rec.bytes, UID);
    expect(wrapped.length).toBeGreaterThanOrEqual(40);
    expect(wrapped.length).toBeLessThanOrEqual(200);

    const device = await lockDown(dk);
    expect(device.extractable).toBe(false);
    const box = await encryptJson(device, UID, { hello: "chart" });
    expect(box.ciphertext).not.toContain("chart");

    const other = await unwrapDataKey(wrapped, parseRecovery(rec.text)!, UID);
    expect(await decryptJson(other, UID, box.ciphertext, box.iv)).toEqual({ hello: "chart" });
  });

  it("fails closed on a wrong recovery key or another account", async () => {
    const rec = newRecoveryKey();
    const dk = await newDataKey();
    const wrapped = await wrapDataKey(dk, rec.bytes, UID);
    await expect(unwrapDataKey(wrapped, newRecoveryKey().bytes, UID)).rejects.toBeTruthy();
    await expect(unwrapDataKey(wrapped, rec.bytes, "someone-else")).rejects.toBeTruthy();

    const box = await encryptJson(await lockDown(dk), UID, { a: 1 });
    await expect(decryptJson(await lockDown(dk), "someone-else", box.ciphertext, box.iv)).rejects.toBeTruthy();
  });
});

describe("vault payload", () => {
  it("collects only the vault keys", () => {
    const s = memStore({ "delphi-birth-v1": "{\"year\":1990}", "cp-active-tab": "clock" });
    const p = collectPayload(s);
    expect(p.items).toEqual({ "delphi-birth-v1": "{\"year\":1990}" });
    expect(payloadEmpty(collectPayload(memStore()))).toBe(true);
  });

  it("merges per item with the primary winning", () => {
    const a = collectPayload(memStore({ "delphi-birth-v1": "A" }));
    const b = collectPayload(memStore({ "delphi-birth-v1": "B", "pneuma-distill-v1": "P" }));
    expect(mergePayloads(a, b).items).toEqual({ "delphi-birth-v1": "A", "pneuma-distill-v1": "P" });
  });

  it("applies, and replace mode carries wipes across devices", () => {
    const s = memStore({ "delphi-birth-v1": "old", "pneuma-distill-v1": "keep" });
    const remote = collectPayload(memStore({ "delphi-birth-v1": "new" }));
    expect(applyPayload(s, remote)).toBe(true);
    expect(s.dump()).toEqual({ "delphi-birth-v1": "new", "pneuma-distill-v1": "keep" });
    expect(applyPayload(s, remote, true)).toBe(true);
    expect(s.dump()).toEqual({ "delphi-birth-v1": "new" });
    expect(applyPayload(s, remote, true)).toBe(false);
  });
});
