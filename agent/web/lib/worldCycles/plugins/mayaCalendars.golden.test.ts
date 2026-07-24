import { describe, expect, it } from "vitest";

import { dreamspellKinFromDate } from "../../galacticFrequency";
import type { CycleContext } from "../types";
import { galactic1320Plugin } from "./galactic1320";
import { tzolkinDelphiPlugin, tzolkinPlugin } from "./tzolkin";

/**
 * Build a CycleContext for a civil calendar date. `hour` is varied in one test to prove
 * the day-counts key off the local civil date, never the UTC instant.
 */
function ctxFor(y: number, m: number, d: number, hour = 12): CycleContext {
  const instant = new Date(Date.UTC(y, m - 1, d, hour));
  return {
    instant,
    jd: instant.getTime() / 86400000 + 2440587.5,
    timeZone: "UTC",
    lat: 0,
    lon: 0,
    localYear: y,
    localMonth: m,
    localDay: d,
    localHour: hour,
    localMinute: 0,
    localSecond: 0,
    dayOfYear: 1,
    ayanamsa: "lahiri",
  };
}

describe("Tzolk'in — canonical GMT 584283 (the count that stays true to the math)", () => {
  it("2026-07-24 is 1 Ak'b'al, Long Count 13.0.13.14.3, and is flagged canonical", () => {
    const r = tzolkinPlugin.resolve(ctxFor(2026, 7, 24));
    expect(r.meta.tone).toBe(1);
    expect(r.meta.sign).toBe("Akbal");
    expect(r.meta.longCount).toBe("13.0.13.14.3");
    // DELPHI numbers kin from 1 Imix = kin 1, so 1 Ak'b'al = kin 183.
    expect(r.meta.kin).toBe(183);
    expect(r.canonical).toBe(true);
  });

  it("2012-12-21 is 4 Ajaw, Long Count 13.0.0.0.0 (the famous baktun turn)", () => {
    const r = tzolkinPlugin.resolve(ctxFor(2012, 12, 21));
    expect(r.meta.tone).toBe(4);
    expect(r.meta.sign).toBe("Ajaw");
    expect(r.meta.longCount).toBe("13.0.0.0.0");
    expect(r.meta.kin).toBe(160);
  });

  it("advances exactly one day-sign per day around 2026-07-24", () => {
    expect(tzolkinPlugin.resolve(ctxFor(2026, 7, 23)).meta).toMatchObject({ tone: 13, sign: "Ik" });
    expect(tzolkinPlugin.resolve(ctxFor(2026, 7, 25)).meta).toMatchObject({ tone: 2, sign: "Kan" });
  });

  it("keys off the local civil date, not the UTC instant (hour must not shift the count)", () => {
    const early = tzolkinPlugin.resolve(ctxFor(2026, 7, 24, 0));
    const late = tzolkinPlugin.resolve(ctxFor(2026, 7, 24, 23));
    expect(early.meta.kin).toBe(late.meta.kin);
    expect(late.meta.tone).toBe(1);
    expect(late.meta.sign).toBe("Akbal");
  });
});

describe("Represent all systems — one canonical, the rest as peers", () => {
  it("the DELPHI-anchor Tzolk'in is a peer reading, NOT canonical, and disagrees with GMT", () => {
    const d = tzolkinDelphiPlugin.resolve(ctxFor(2026, 7, 24));
    expect(d.canonical).toBe(false);
    expect(d.meta.kin).toBe(209); // its own 2024-07-26 = kin 1 anchor
    expect(d.meta.kin).not.toBe(tzolkinPlugin.resolve(ctxFor(2026, 7, 24)).meta.kin);
  });

  it("exactly one Maya day-count reading is canonical (GMT)", () => {
    const canon = [tzolkinPlugin, tzolkinDelphiPlugin, galactic1320Plugin]
      .map((p) => p.resolve(ctxFor(2026, 7, 24)))
      .filter((r) => r.canonical === true);
    expect(canon).toHaveLength(1);
    expect(canon[0]!.systemId).toBe("maya_tzolkin");
  });

  it("all three systems disagree (they are different systems, correctly)", () => {
    const gmt = tzolkinPlugin.resolve(ctxFor(2026, 7, 24)).meta.kin;
    const delphi = tzolkinDelphiPlugin.resolve(ctxFor(2026, 7, 24)).meta.kin;
    const dream = galactic1320Plugin.resolve(ctxFor(2026, 7, 24)).meta.kin;
    expect(new Set([gmt, delphi, dream]).size).toBe(3);
  });
});

describe("Dreamspell 13:20 — independent count", () => {
  it("anchors 26 Jul 2013 to Kin 164 (Yellow Galactic Seed)", () => {
    expect(dreamspellKinFromDate(2013, 7, 26)).toBe(164);
  });

  it("skips 29 Feb: 26 Jul 2016 is Kin 219, one less than a naive day count would give", () => {
    // 1096 calendar days from the anchor, minus one skipped leap day = 1095 kin steps.
    expect(dreamspellKinFromDate(2016, 7, 26)).toBe(219);
  });

  it("is not canonical and does not tie to the Long Count", () => {
    const ds = galactic1320Plugin.resolve(ctxFor(2026, 7, 24));
    expect(ds.canonical).toBeFalsy();
    expect(ds.meta.longCount).toBeUndefined();
  });
});
