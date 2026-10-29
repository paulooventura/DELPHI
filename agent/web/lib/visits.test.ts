import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionVisitCount } from "./visits";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("pm-visits counts once per tab session", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  it("a first visit is visit 1, however many times it is asked", () => {
    expect(sessionVisitCount()).toBe(1);
    expect(sessionVisitCount()).toBe(1);
  });

  it("does not count again when pm-telemetry.js already counted this session", () => {
    localStorage.setItem("pm-visits", "1");
    sessionStorage.setItem("pm-visit-counted", "1");
    expect(sessionVisitCount()).toBe(1);
  });

  it("a new tab session is the next visit", () => {
    expect(sessionVisitCount()).toBe(1);
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(sessionVisitCount()).toBe(2);
  });
});
