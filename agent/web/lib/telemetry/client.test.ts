import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  USAGE_NOTRACK_KEY,
  USAGE_OPTIN_KEY,
  setUsageOptIn,
  usageBlockedByBrowser,
  usageOptedIn,
} from "./client";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

function setup({ app = false, gpc = false } = {}) {
  const ls = memoryStorage();
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  if (app) win.Capacitor = { isNativePlatform: () => true };
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("navigator", { globalPrivacyControl: gpc });
  return ls;
}

describe("usage counts switch (T319)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("web: on by default; Don't share sets pm-notrack, Share clears it", () => {
    const ls = setup();
    expect(usageOptedIn()).toBe(true);
    setUsageOptIn(false, "t");
    expect(ls.getItem(USAGE_NOTRACK_KEY)).toBe("1");
    expect(usageOptedIn()).toBe(false);
    setUsageOptIn(true, "t");
    expect(ls.getItem(USAGE_NOTRACK_KEY)).toBeNull();
    expect(usageOptedIn()).toBe(true);
    expect(ls.getItem(USAGE_OPTIN_KEY)).toBeNull();
  });

  it("web: Global Privacy Control keeps it off", () => {
    setup({ gpc: true });
    expect(usageBlockedByBrowser()).toBe(true);
    expect(usageOptedIn()).toBe(false);
  });

  it("iOS app: off by default; Share opts in without touching pm-notrack", () => {
    const ls = setup({ app: true });
    expect(usageOptedIn()).toBe(false);
    expect(usageBlockedByBrowser()).toBe(false);
    setUsageOptIn(true, "t");
    expect(ls.getItem(USAGE_OPTIN_KEY)).toBe("1");
    expect(ls.getItem(USAGE_NOTRACK_KEY)).toBeNull();
    expect(usageOptedIn()).toBe(true);
    setUsageOptIn(false, "t");
    expect(usageOptedIn()).toBe(false);
  });
});
