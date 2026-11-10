import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGES_MAX_MA,
  setAges,
  CLOCK_MAX_MS,
  clockLabel,
  clockMs,
  clockState,
  freezeNow,
  fromLocalInputValue,
  goLive,
  holdAt,
  isClockLive,
  resetClockForTests,
  shiftBy,
  subscribeClock,
  toLocalInputValue,
} from "./pneumaClock";

afterEach(() => {
  resetClockForTests();
  vi.useRealTimers();
});

describe("pneumaClock", () => {
  it("starts live and follows the real now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    expect(isClockLive()).toBe(true);
    expect(clockMs()).toBe(Date.parse("2026-11-10T12:00:00Z"));
    vi.setSystemTime(new Date("2026-11-10T12:00:05Z"));
    expect(clockMs()).toBe(Date.parse("2026-11-10T12:00:05Z"));
  });

  it("holds a moment until it goes live again", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    const pangeaish = Date.UTC(1610, 2, 12, 21, 4);
    holdAt(pangeaish, "orrery");
    vi.setSystemTime(new Date("2026-11-10T13:00:00Z"));
    expect(clockMs()).toBe(pangeaish);
    expect(clockState().by).toBe("orrery");
    goLive();
    expect(clockMs()).toBe(Date.parse("2026-11-10T13:00:00Z"));
  });

  it("freezes at now and shifts from there", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    freezeNow();
    vi.setSystemTime(new Date("2026-11-10T18:00:00Z"));
    expect(clockMs()).toBe(Date.parse("2026-11-10T12:00:00Z"));
    shiftBy(3_600_000);
    expect(clockMs()).toBe(Date.parse("2026-11-10T13:00:00Z"));
  });

  it("tells subscribers once per real change", () => {
    const fn = vi.fn();
    const off = subscribeClock(fn);
    holdAt(1000);
    holdAt(1000);
    goLive();
    goLive();
    off();
    holdAt(2000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stays inside Date's range and ignores nonsense", () => {
    holdAt(9e18);
    expect(clockMs()).toBe(CLOCK_MAX_MS);
    expect(Number.isFinite(new Date(clockMs()).getTime())).toBe(true);
    holdAt(Number.NaN);
    expect(clockMs()).toBe(CLOCK_MAX_MS);
  });

  it("labels live, held and BCE moments", () => {
    expect(clockLabel()).toBe("Live");
    const d = new Date(2000, 0, 1, 9, 5);
    d.setFullYear(-43);
    holdAt(d.getTime());
    expect(clockLabel(clockState(), false)).toBe("1 Jan 44 BCE");
    holdAt(new Date(1969, 6, 20, 20, 17).getTime());
    expect(clockLabel()).toBe("20 Jul 1969 · 20:17");
  });

  it("keeps deep time on its own axis, clamped to the continents we have", () => {
    holdAt(1000, "orrery");
    setAges(200);
    expect(clockState().agesMa).toBe(200);
    expect(clockMs()).toBe(1000);
    setAges(9999);
    expect(clockState().agesMa).toBe(AGES_MAX_MA);
    setAges(-5);
    expect(clockState().agesMa).toBe(0);
    goLive();
    expect(clockState().agesMa).toBe(0);
    setAges(null);
    expect(clockState().agesMa).toBeNull();
  });

  it("round-trips the date picker's value, including early years", () => {
    const d = new Date(2000, 0, 1, 0, 0);
    d.setFullYear(812, 4, 9);
    d.setHours(6, 30);
    const v = toLocalInputValue(d.getTime());
    expect(v).toBe("0812-05-09T06:30");
    expect(fromLocalInputValue(v)).toBe(d.getTime());
    expect(fromLocalInputValue("")).toBeNaN();
  });
});
