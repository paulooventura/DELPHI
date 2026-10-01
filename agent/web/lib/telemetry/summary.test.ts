import { describe, expect, it } from "vitest";
import { summarizeUsage, type UsageSession } from "./summary";
import { toUsageRows } from "../db/server";

const base: UsageSession = {
  session_id: "s1",
  visitor_id: "v1",
  visit_number: 1,
  active_s: 120,
  taps: 4,
  screens: { home: 90, heliodrome: 30 },
  other_s: 0,
  from_tag: "maya",
  referrer: "instagram.com",
  device: "mobile",
  os: "iOS",
  browser: "Safari",
  city: "Nashville",
  country: "US",
};

describe("summarizeUsage", () => {
  it("aggregates visitors, time per screen, and taps", () => {
    const s = summarizeUsage(
      [
        base,
        { ...base, active_s: 60, screens: { home: 60 } },
        { ...base, session_id: "s2", visitor_id: "v2", visit_number: 3, from_tag: "", referrer: "" },
      ],
      [
        { at: "2026-10-01T10:00:00Z", received_at: "2026-10-01T10:05:00Z", event: "session_start", screen: "", detail: "" },
        { at: "2026-10-01T10:01:00Z", received_at: "2026-10-01T10:05:00Z", event: "tap", screen: "home", detail: "Open Heliodrome" },
        { at: "2026-10-01T10:02:00Z", received_at: "2026-10-01T10:05:00Z", event: "tap:natal-edit", screen: "heliodrome", detail: "" },
        { at: "2026-10-01T10:03:00Z", received_at: "2026-10-01T10:05:00Z", event: "aulos_play", screen: "home", detail: "" },
      ],
    );
    expect(s.visitors).toBe(2);
    expect(s.returningVisitors).toBe(1);
    expect(s.visits).toBe(2);
    expect(s.avgMinutesPerVisit).toBeCloseTo(300 / 2 / 60);
    expect(s.screens[0]).toMatchObject({ screen: "home" });
    expect(s.perDay).toEqual([{ day: "2026-10-01", count: 1 }]);
    expect(s.buttons.map((b) => b.key)).toEqual(["home · Open Heliodrome", "heliodrome · natal-edit"]);
    expect(s.features).toEqual([{ key: "aulos_play", count: 1 }]);
    expect(s.referrers.map((r) => r.key).sort()).toEqual(["(direct)", "instagram.com"]);
  });
});

describe("toUsageRows", () => {
  it("folds screen columns into jsonb and converts times", () => {
    const { session, events } = toUsageRows({
      session: {
        session_id: "abc",
        visitor_id: "def",
        segment: 1,
        from: "maya",
        visit_number: 2,
        session_started_at: 1_790_000_000_000,
        segment_started_at: 1_790_000_000_000,
        segment_ended_at: 1_790_000_060_000,
        active_s: 60,
        taps: 1,
        home_s: 40,
        psyche_s: 20,
        aether_s: 0,
        other_s: 0,
      },
      events: [{ at: 1_790_000_010_000, event: "tap", screen: "home", detail: "'=x" }],
    });
    expect(session.screens).toEqual({ home: 40, psyche: 20 });
    expect(session.from_tag).toBe("maya");
    expect(session.segment_ended_at).toBe(new Date(1_790_000_060_000).toISOString());
    expect(events[0].detail).toBe("=x");
  });
});
