import { describe, expect, it } from "vitest";
import { parseDevice, refHost, SCREEN_COLUMNS, shapeTrack } from "./track";

const NOW = 1_790_000_000_000;
const ctx = {
  geo: { city: "Nashville", region: "TN", country: "US" },
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  build: "test",
  now: NOW,
};

function beacon(over: Record<string, unknown> = {}) {
  return {
    v: 1,
    sid: "a1b2c3d4e5f6a7b8c9",
    vid: "0f0e0d0c0b0a090807",
    seg: 1,
    from: "Maya",
    visit: 2,
    started: NOW - 120_000,
    segStart: NOW - 120_000,
    ended: NOW,
    active: 999,
    taps: 3,
    screens: { home: 60, heliodrome: 40, other: 5, "bad name!": 9 },
    events: [
      { t: NOW - 100_000, n: "session_start", s: "home", d: "from maya" },
      { t: NOW - 50_000, n: "tap", s: "home", d: "=HYPERLINK(\"x\")" },
      { t: NOW - 40_000, n: "BAD NAME", s: "home", d: "" },
    ],
    entry: "/",
    ref: "https://www.instagram.com/some/private/path?token=1",
    path: "/",
    vw: 390,
    vh: 844,
    ...over,
  };
}

describe("shapeTrack", () => {
  it("shapes a session row with every screen column", () => {
    const rows = shapeTrack(beacon(), ctx)!;
    expect(rows.session.home_s).toBe(60);
    expect(rows.session.heliodrome_s).toBe(40);
    expect(rows.session.other_s).toBe(5);
    expect(rows.session.active_s).toBe(105);
    for (const c of SCREEN_COLUMNS) expect(rows.session).toHaveProperty(`${c}_s`);
    expect(rows.session.from).toBe("maya");
    expect(rows.session.referrer).toBe("instagram.com");
    expect(rows.session.device).toBe("mobile");
    expect(rows.session.city).toBe("Nashville");
  });

  it("drops malformed events and neutralises formulas", () => {
    const rows = shapeTrack(beacon(), ctx)!;
    expect(rows.events.map(e => e.event)).toEqual(["session_start", "tap"]);
    expect(rows.events[1].detail.startsWith("=")).toBe(false);
  });

  it("rejects bad ids and empty beacons", () => {
    expect(shapeTrack(beacon({ sid: "nope" }), ctx)).toBeNull();
    expect(shapeTrack(beacon({ screens: {}, events: [] }), ctx)).toBeNull();
    expect(shapeTrack("x", ctx)).toBeNull();
  });

  it("clamps timestamps from the future", () => {
    const rows = shapeTrack(beacon({ ended: NOW + 10 * 86_400_000 }), ctx)!;
    expect(rows.session.segment_ended_at).toBeLessThanOrEqual(NOW + 60_000);
  });

  it("blanks digits in event detail", () => {
    const rows = shapeTrack(beacon({ events: [{ t: NOW, n: "tap", s: "home", d: "Born 1987" }] }), ctx)!;
    expect(rows.events[0].detail).toBe("Born ####");
  });
});

describe("parseDevice / refHost", () => {
  it("spots in-app browsers and desktops", () => {
    expect(parseDevice("Mozilla/5.0 (iPhone) Instagram 300.0").browser).toBe("Instagram in-app");
    expect(parseDevice("Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/130.0 Safari/537.36")).toEqual({
      device: "desktop",
      os: "Windows",
      browser: "Chrome",
    });
    expect(parseDevice("Mozilla/5.0 (iPad; CPU OS 18_0) Safari/604.1").device).toBe("tablet");
  });

  it("keeps only the referrer host", () => {
    expect(refHost("https://l.facebook.com/l.php?u=secret")).toBe("l.facebook.com");
    expect(refHost("not a url")).toBe("");
  });
});
