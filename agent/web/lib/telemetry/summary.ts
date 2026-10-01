/** Aggregates usage rows for the admin page. Pure. */

export type UsageSession = {
  session_id: string;
  visitor_id: string;
  visit_number: number;
  active_s: number;
  taps: number;
  screens: Record<string, number> | null;
  other_s: number;
  from_tag: string;
  referrer: string;
  device: string;
  os: string;
  browser: string;
  city: string;
  country: string;
};

export type UsageEvent = { at: string | null; received_at: string; event: string; screen: string; detail: string };

type Count = { key: string; count: number };

function top(map: Map<string, number>, n: number): Count[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function bump(map: Map<string, number>, key: string, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + by);
}

export function summarizeUsage(sessions: UsageSession[], events: UsageEvent[]) {
  const visitors = new Set<string>();
  const returning = new Set<string>();
  const sessionIds = new Set<string>();
  const screenSecs = new Map<string, number>();
  let activeS = 0;
  let taps = 0;

  for (const s of sessions) {
    visitors.add(s.visitor_id);
    sessionIds.add(s.session_id);
    if (s.visit_number > 1) returning.add(s.visitor_id);
    activeS += s.active_s || 0;
    taps += s.taps || 0;
    for (const [k, v] of Object.entries(s.screens || {})) bump(screenSecs, k, Number(v) || 0);
    if (s.other_s) bump(screenSecs, "other", s.other_s);
  }

  const perDay = new Map<string, number>();
  const from = new Map<string, number>();
  const referrers = new Map<string, number>();
  const cities = new Map<string, number>();
  const devices = new Map<string, number>();
  const buttons = new Map<string, number>();
  const features = new Map<string, number>();
  const firstSession = new Map<string, UsageSession>();
  for (const s of sessions) if (!firstSession.has(s.session_id)) firstSession.set(s.session_id, s);

  for (const e of events) {
    if (e.event === "session_start") {
      bump(perDay, (e.at || e.received_at).slice(0, 10));
    } else if (e.event === "tap" || e.event.startsWith("tap:")) {
      const label = e.event === "tap" ? e.detail : e.event.slice(4);
      if (label) bump(buttons, `${e.screen || "?"} · ${label}`);
    } else {
      bump(features, e.event);
    }
  }
  for (const s of firstSession.values()) {
    bump(from, s.from_tag);
    bump(referrers, s.referrer || "(direct)");
    bump(cities, [s.city, s.country].filter(Boolean).join(", ") || "(unknown)");
    bump(devices, [s.device, s.os, s.browser].filter(Boolean).join(" · "));
  }

  const totalScreen = [...screenSecs.values()].reduce((a, b) => a + b, 0) || 1;
  return {
    visitors: visitors.size,
    returningVisitors: returning.size,
    visits: sessionIds.size,
    avgMinutesPerVisit: sessionIds.size ? activeS / sessionIds.size / 60 : 0,
    totalHours: activeS / 3600,
    taps,
    screens: top(screenSecs, 30).map((c) => ({ screen: c.key, minutes: c.count / 60, share: c.count / totalScreen })),
    perDay: [...perDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, count]) => ({ day, count })),
    from: top(from, 30),
    referrers: top(referrers, 20),
    buttons: top(buttons, 40),
    features: top(features, 30),
    cities: top(cities, 25),
    devices: top(devices, 15),
  };
}

export type UsageSummary = ReturnType<typeof summarizeUsage>;
