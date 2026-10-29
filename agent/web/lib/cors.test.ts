import { describe, expect, it } from "vitest";
import { appCorsHeaders } from "./cors";

describe("appCorsHeaders", () => {
  it("lets the iOS app origin call the API", () => {
    const h = appCorsHeaders("capacitor://localhost");
    expect(h?.["Access-Control-Allow-Origin"]).toBe("capacitor://localhost");
    expect(h?.["Access-Control-Allow-Headers"]).toContain("Authorization");
  });

  it("adds nothing for other sites or same-origin calls", () => {
    expect(appCorsHeaders("https://evil.example")).toBeNull();
    expect(appCorsHeaders(null)).toBeNull();
  });
});
