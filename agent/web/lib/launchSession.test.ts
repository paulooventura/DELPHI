import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cameFromDoor,
  hasLaunchedThisSession,
  LAUNCH_KEY,
  markLaunchedThisSession,
  shouldPlaySplash,
  type LaunchLoad,
} from "./launchSession";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("sessionStorage", memory);
  return memory;
}

describe("launchSession", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is unset until splash completes", () => {
    expect(hasLaunchedThisSession()).toBe(false);
    markLaunchedThisSession();
    expect(hasLaunchedThisSession()).toBe(true);
    expect(sessionStorage.getItem(LAUNCH_KEY)).toBe("1");
  });

  it("clears when the page session ends", () => {
    markLaunchedThisSession();
    sessionStorage.removeItem(LAUNCH_KEY);
    expect(hasLaunchedThisSession()).toBe(false);
  });
});

describe("shouldPlaySplash", () => {
  const origin = "https://delphi.pauloventura.org";
  const load = (over: Partial<LaunchLoad>): LaunchLoad => ({
    embed: false,
    navType: "navigate",
    referrer: "",
    origin,
    launchedThisSession: false,
    ...over,
  });

  it("plays on a fresh open, even when this tab already saw it", () => {
    expect(shouldPlaySplash(load({}))).toBe(true);
    expect(shouldPlaySplash(load({ launchedThisSession: true }))).toBe(true);
    expect(shouldPlaySplash(load({ navType: null }))).toBe(true);
  });

  it("plays on reload, even if the page first came from a door", () => {
    expect(shouldPlaySplash(load({ navType: "reload", launchedThisSession: true }))).toBe(true);
    expect(shouldPlaySplash(load({ navType: "reload", referrer: `${origin}/studies`, launchedThisSession: true }))).toBe(true);
  });

  it("skips a link back from Studies, Tonal or the portal", () => {
    for (const p of ["/studies", "/tonal", "/portal", "/portal.html?b=1", "/portal/x"]) {
      expect(shouldPlaySplash(load({ referrer: `${origin}${p}`, launchedThisSession: true }))).toBe(false);
    }
  });

  it("plays when the referrer is another site or another app page", () => {
    expect(shouldPlaySplash(load({ referrer: "https://example.com/studies" }))).toBe(true);
    expect(shouldPlaySplash(load({ referrer: `${origin}/?mode=sky` }))).toBe(true);
    expect(shouldPlaySplash(load({ referrer: `${origin}/tonality` }))).toBe(true);
  });

  it("skips Back into the app after it already played in this tab", () => {
    expect(shouldPlaySplash(load({ navType: "back_forward", launchedThisSession: true }))).toBe(false);
    expect(shouldPlaySplash(load({ navType: "back_forward", launchedThisSession: false }))).toBe(true);
  });

  it("never plays inside a Chorus embed", () => {
    expect(shouldPlaySplash(load({ embed: true }))).toBe(false);
    expect(shouldPlaySplash(load({ embed: true, navType: "reload" }))).toBe(false);
  });

  it("reads a malformed referrer as no door", () => {
    expect(cameFromDoor("not a url", origin)).toBe(false);
  });
});
