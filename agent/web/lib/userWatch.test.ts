import { describe, expect, it, vi } from "vitest";
import { watchUser, type UserFix } from "./userWatch";

function fakeEnv(state: PermissionState = "granted") {
  let nextId = 1;
  const watches = new Map<number, PositionCallback>();
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const geolocation = {
    watchPosition: vi.fn((ok: PositionCallback) => {
      const id = nextId++;
      watches.set(id, ok);
      return id;
    }),
    clearWatch: vi.fn((id: number) => watches.delete(id)),
    getCurrentPosition: vi.fn(),
  };
  const permissions = { query: vi.fn(async () => ({ state })) };
  const move = (lat: number, lon: number, heading: number | null = null) =>
    watches.forEach(cb =>
      cb({ coords: { latitude: lat, longitude: lon, heading, speed: 12, accuracy: 5 }, timestamp: Date.now() } as unknown as GeolocationPosition),
    );
  const setHidden = (h: boolean) => {
    doc.hidden = h;
    listeners.forEach(fn => fn());
  };
  return {
    env: {
      geolocation: geolocation as unknown as Geolocation,
      permissions: permissions as unknown as Permissions,
      doc: doc as unknown as Document,
    },
    geolocation,
    watches,
    listeners,
    move,
    setHidden,
  };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe("watchUser: the map follows the reader", () => {
  it("reports every new position, not just the first", async () => {
    const f = fakeEnv();
    const fixes: UserFix[] = [];
    const stop = watchUser(fix => fixes.push(fix), f.env);
    await flush();
    f.move(36.16, -86.78);
    f.move(36.17, -86.77, 90);
    expect(fixes).toEqual([
      { lat: 36.16, lon: -86.78, heading: null, speed: 12 },
      { lat: 36.17, lon: -86.77, heading: 90, speed: 12 },
    ]);
    stop();
  });

  it("never asks: no watch unless location is already granted", async () => {
    const f = fakeEnv("prompt");
    const stop = watchUser(() => {}, f.env);
    await flush();
    expect(f.geolocation.watchPosition).not.toHaveBeenCalled();
    expect(f.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    stop();
  });

  it("pauses while the page is hidden and resumes when it returns", async () => {
    const f = fakeEnv();
    const stop = watchUser(() => {}, f.env);
    await flush();
    expect(f.watches.size).toBe(1);
    f.setHidden(true);
    expect(f.watches.size).toBe(0);
    f.setHidden(false);
    expect(f.watches.size).toBe(1);
    stop();
  });

  it("stop clears the watch and the listener", async () => {
    const f = fakeEnv();
    const fixes: UserFix[] = [];
    const stop = watchUser(fix => fixes.push(fix), f.env);
    await flush();
    stop();
    f.move(1, 2);
    expect(f.watches.size).toBe(0);
    expect(f.listeners.size).toBe(0);
    expect(fixes).toEqual([]);
  });
});
