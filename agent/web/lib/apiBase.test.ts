import { afterEach, describe, expect, it, vi } from "vitest";

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps same-origin paths on the website", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    const { apiUrl } = await import("./apiBase");
    expect(apiUrl("/api/cycles?x=1")).toBe("/api/cycles?x=1");
  });

  it("points the bundled app at the live site", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "https://delphi.pauloventura.org/");
    const { apiUrl } = await import("./apiBase");
    expect(apiUrl("/api/orbits/active")).toBe("https://delphi.pauloventura.org/api/orbits/active");
  });
});
