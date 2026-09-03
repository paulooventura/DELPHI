import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasLaunchedThisSession,
  LAUNCH_KEY,
  markLaunchedThisSession,
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
