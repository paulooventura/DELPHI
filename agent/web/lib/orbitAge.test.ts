import { describe, expect, it } from "vitest";
import { newerOrbitSet, orbitFreshness, orbitSourceLabel } from "./orbitAge";

const now = Date.parse("2026-10-29T12:00:00Z");
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("orbit age offline", () => {
  it("trusts sets for 3 days, marks them approximate to 14, then leaves them out", () => {
    expect(orbitFreshness(daysAgo(1), now)).toBe("fresh");
    expect(orbitFreshness(daysAgo(5), now)).toBe("approximate");
    expect(orbitFreshness(daysAgo(15), now)).toBe("expired");
    expect(orbitFreshness("not a date", now)).toBe("expired");
  });

  it("says the age in the source line once positions are approximate", () => {
    expect(orbitSourceLabel("CelesTrak", daysAgo(1), now)).toBe("CelesTrak");
    expect(orbitSourceLabel("CelesTrak", daysAgo(5.5), now)).toBe("CelesTrak · approximate, 5 days old");
  });

  it("keeps whichever copy was downloaded last", () => {
    const old = { fetchedAt: daysAgo(6), id: "cache" };
    const fresh = { fetchedAt: daysAgo(2), id: "bundle" };
    expect(newerOrbitSet(old, fresh)?.id).toBe("bundle");
    expect(newerOrbitSet(null, old)?.id).toBe("cache");
  });
});
