import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasAccessThisSession,
  hasPrimedDeviceAccess,
  markAccessThisSession,
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
  vi.stubGlobal("sessionStorage", memory);
  return memory;
}

describe("deviceAccess — ask on open gesture", () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) => {
          ok({
            coords: {
              latitude: 36.16,
              longitude: -86.78,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON() {
                return this;
              },
            },
            timestamp: Date.now(),
            toJSON() {
              return this;
            },
          } as GeolocationPosition);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("marks primed after location + sensor ask", async () => {
    expect(hasPrimedDeviceAccess()).toBe(false);
    expect(hasAccessThisSession()).toBe(false);
    const grants = await requestDeviceAccessPermissions();
    expect(typeof grants.location).toBe("boolean");
    expect(typeof grants.orientation).toBe("boolean");
    expect(typeof grants.motion).toBe("boolean");
    expect(grants.location).toBe(true);
    expect(hasPrimedDeviceAccess()).toBe(true);
    expect(hasAccessThisSession()).toBe(true);
    markDeviceAccessPrimed();
    expect(hasPrimedDeviceAccess()).toBe(true);
  });

  it("session grant is separate from a closed page", () => {
    expect(hasAccessThisSession()).toBe(false);
    markAccessThisSession();
    expect(hasAccessThisSession()).toBe(true);
    expect(hasPrimedDeviceAccess()).toBe(true);
    sessionStorage.removeItem("delphi-access-session-v1");
    expect(hasAccessThisSession()).toBe(false);
    expect(hasPrimedDeviceAccess()).toBe(true);
  });
});
