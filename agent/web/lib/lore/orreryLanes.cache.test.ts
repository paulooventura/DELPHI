import { describe, expect, it } from "vitest";
import { computeOrreryState } from "./orreryLanes";
import { computeSolarDayEvents } from "../cosmic/astronomy";

const FRAME_MS = 1000 / 60;
/** Far below a pixel on any lane width the Orrery draws. */
const PROGRESS_TOL = 1e-3;

const PLACES: Array<[string, number, number]> = [
  ["Nashville", 36.16, -86.78],
  ["Tokyo", 35.68, 139.69],
  ["Reykjavik", 64.15, -21.94],
  ["Kathmandu", 27.72, 85.32],
];

type State = ReturnType<typeof computeOrreryState>;

/** Cached state may only lag the uncached one by the 1 s sky quantum, never by more. */
function expectSameToTheEye(date: Date, lat: number, lon: number) {
  const at = date.toISOString();
  const cached = computeOrreryState(date, lat, lon);
  const exact = computeOrreryState(date, lat, lon, { cache: false });
  let second: State | undefined;
  const atSecond = () =>
    (second ??= computeOrreryState(
      new Date(Math.floor(date.getTime() / 1000) * 1000), lat, lon, { cache: false },
    ));
  expect(cached.lanes.map(l => l.id)).toEqual(exact.lanes.map(l => l.id));
  cached.lanes.forEach((c, i) => {
    const e = exact.lanes[i]!;
    const ctx = `${c.id} @ ${at}`;
    expect(c.cells.map(x => x.id), ctx).toEqual(e.cells.map(x => x.id));
    if (c.index === e.index) {
      expect(c.activeLabel, ctx).toBe(e.activeLabel);
      expect(Math.abs(c.progress - e.progress), ctx).toBeLessThan(PROGRESS_TOL);
    } else {
      const s = atSecond().lanes[i]!;
      expect(c.index, ctx).toBe(s.index);
      expect(Math.abs(c.progress - s.progress), ctx).toBeLessThan(PROGRESS_TOL);
    }
  });
  cached.slowSky.forEach((c, i) => {
    const e = exact.slowSky[i]!;
    expect(c.id).toBe(e.id);
    if (c.value !== e.value) expect(c.value, `${c.id} @ ${at}`).toBe(atSecond().slowSky[i]!.value);
  });
}

function sweep(startMs: number, frames: number, lat: number, lon: number) {
  for (let f = 0; f < frames; f++) {
    expectSameToTheEye(new Date(startMs + f * FRAME_MS), lat, lon);
  }
}

describe("orrery lanes — cache matches the uncached clock", () => {
  it("fast lanes (ms, rega, second, minute, beat) are exact every frame", () => {
    const t0 = Date.parse("2026-10-30T05:00:00Z");
    for (let f = 0; f < 240; f++) {
      const d = new Date(t0 + f * FRAME_MS);
      const cached = computeOrreryState(d, 36.16, -86.78);
      const exact = computeOrreryState(d, 36.16, -86.78, { cache: false });
      for (const id of ["ms", "rega", "sec", "helek", "min", "beat"]) {
        const c = cached.lanes.find(l => l.id === id);
        const e = exact.lanes.find(l => l.id === id);
        if (!c || !e) continue;
        expect(c.index, id).toBe(e.index);
        expect(c.progress, id).toBeCloseTo(e.progress, 9);
      }
    }
  });

  for (const [name, lat, lon] of PLACES) {
    it(`frame sweep across sunrise, sunset and local midnight in ${name}`, () => {
      const day = new Date("2026-10-30T12:00:00Z");
      const ev = computeSolarDayEvents(day, lat, lon);
      const marks = [ev.sunrise.getTime(), ev.sunset.getTime()];
      const midnight = Date.parse(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(day) + "T00:00:00Z",
      ) - (lon / 15) * 3_600_000;
      marks.push(midnight);
      for (const m of marks) {
        if (!Number.isFinite(m)) continue;
        sweep(m - 1_000, 120, lat, lon);
      }
    }, 30_000);
  }

  it("random jumps across a year (scrubbing the date) stay identical to the eye", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const base = Date.parse("2026-01-01T00:00:00Z");
    for (let i = 0; i < 300; i++) {
      const [, lat, lon] = PLACES[i % PLACES.length]!;
      const t = base + rnd() * 365 * 86_400_000;
      expectSameToTheEye(new Date(t), lat, lon);
    }
  }, 30_000);

  it("returns stable cell rows so the Orrery does not rebuild them every frame", () => {
    const a = computeOrreryState(new Date("2026-10-30T05:00:00Z"), 36.16, -86.78);
    const b = computeOrreryState(new Date("2026-10-30T05:00:00.016Z"), 36.16, -86.78);
    a.lanes.forEach((l, i) => expect(b.lanes[i]!.cells).toBe(l.cells));
  });
});
