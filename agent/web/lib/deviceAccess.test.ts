import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasPrimedDeviceAccess,
  markDeviceAccessPrimed,
  requestDeviceAccessPermissions,
} from "./deviceAccess";

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
  vi.stubGlobal("localStorage", memory);
  return memory;
}

describe("deviceAccess — ask once", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("marks primed after requestDeviceAccessPermissions", async () => {
    expect(hasPrimedDeviceAccess()).toBe(false);
    const grants = await requestDeviceAccessPermissions();
    expect(typeof grants.orientation).toBe("boolean");
    expect(typeof grants.motion).toBe("boolean");
    expect(hasPrimedDeviceAccess()).toBe(true);
    markDeviceAccessPrimed();
    expect(hasPrimedDeviceAccess()).toBe(true);
  });
});
