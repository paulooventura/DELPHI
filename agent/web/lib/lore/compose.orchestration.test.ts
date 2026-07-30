import { describe, expect, it } from "vitest";
import {
  compose,
  distillTemplate,
  orchestrate,
  orchestratedPrompt,
  takeSnapshot,
  decompose,
  provenance,
} from "./compose";
import { resolveMoment } from "./resolveMoment";
import { jdFromDate } from "../phase/timeResolution";
import type { Composition } from "./compose";
import type { QualiaEntry } from "./qualia";

/** Synthetic bright + settled field → warm-witness. */
function brightSettledChord(): Composition {
  const mk = (
    name: string,
    system: string,
    polarities: QualiaEntry["polarities"],
  ): QualiaEntry =>
    ({
      id: `test-${name}`,
      system,
      name,
      glyph: "·",
      qualities: ["radiant", "warm", "steady"],
      polarities,
      source: "test",
      claim: "interpretation",
      nature: "computed",
      observes: "moment",
      honesty: "render",
      tier: "celebrated",
      origin: ["test"],
      observed: name,
    }) as QualiaEntry;

  return compose([
    mk("Bright", "western-zodiac", {
      light: 0.85, warm: 0.7, gentle: 0.5, steady: 0.55, active: 0.4,
    }),
    mk("Settled", "moon-phase", {
      light: 0.75, warm: 0.55, gentle: 0.4, steady: 0.6, rising: 0.2,
    }),
    mk("Open", "element", {
      light: 0.7, warm: 0.6, outward: 0.5, gentle: 0.35,
    }),
    mk("HourSoft", "planetary-hour", {
      light: 0.4, warm: 0.3, gentle: 0.25,
    }),
  ]);
}

/** Synthetic charged + shadowed field → trickster-challenge. */
function chargedShadowedChord(): Composition {
  const mk = (
    name: string,
    system: string,
    polarities: QualiaEntry["polarities"],
  ): QualiaEntry =>
    ({
      id: `test-${name}`,
      system,
      name,
      glyph: "·",
      qualities: ["fierce", "shadowed", "binding"],
      polarities,
      source: "test",
      claim: "interpretation",
      nature: "computed",
      observes: "moment",
      honesty: "render",
      tier: "celebrated",
      origin: ["test"],
      observed: name,
    }) as QualiaEntry;

  return compose([
    mk("Dark", "moon-phase", {
      light: -0.8, warm: -0.5, gentle: -0.6, binding: 0.7, active: -0.3,
    }),
    mk("Fierce", "western-zodiac", {
      light: -0.5, warm: -0.3, gentle: -0.7, binding: -0.75, active: 0.6,
    }),
    mk("Cool", "element", {
      light: -0.55, warm: -0.65, gentle: -0.4, binding: 0.55,
    }),
    mk("MarsHour", "planetary-hour", {
      light: -0.4, gentle: -0.7, active: 0.8, warm: 0.2,
    }),
  ]);
}

describe("Addendum 4 — orchestration (invariant 12)", () => {
  it("bright settled → warm-witness; charged shadowed → trickster-challenge", () => {
    const bright = orchestrate(brightSettledChord());
    const dark = orchestrate(chargedShadowedChord());

    expect(bright.tone.register).toBe("warm-witness");
    expect(dark.tone.register).toBe("trickster-challenge");
    expect(bright.tone.register).not.toBe(dark.tone.register);

    expect(bright.tone.warmth).toBeGreaterThan(0.2);
    expect(bright.tone.charge).toBeLessThan(0.35);
    expect(dark.tone.clarity).toBeLessThan(0);
    expect(dark.tone.charge).toBeGreaterThan(0.6);
  });

  it("orchestratedPrompt carries distinct registers and names no systems", () => {
    const brightP = orchestratedPrompt(brightSettledChord());
    const darkP = orchestratedPrompt(chargedShadowedChord());

    expect(brightP.user).toMatch(/REGISTER: warm-witness/);
    expect(darkP.user).toMatch(/REGISTER: trickster-challenge/);
    expect(brightP.system).toMatch(/warm witness/i);
    expect(darkP.system).toMatch(/trickster/i);

    for (const p of [brightP, darkP]) {
      expect(p.system + p.user).not.toMatch(
        /\b(Leo|Horse|Mars|Saturn|nakshatra|tzolk|wuku|muhūrta|muhurta)\b/i,
      );
    }
  });

  it("offline distillTemplate stays grammatical and system-free for both fields", () => {
    for (const chord of [brightSettledChord(), chargedShadowedChord()]) {
      const phrase = distillTemplate(chord);
      expect(phrase.endsWith(".")).toBe(true);
      expect(phrase).not.toMatch(/leo|mars|horse|nakshatra|wuku|saturn/i);
      expect(phrase.length).toBeGreaterThan(12);
    }
  });

  it("live Nashville fields — registers vary; every voice still in decomposition", () => {
    const lat = 36.16;
    const lon = -86.78;
    // Known live pair: plain-reading vs trickster-challenge (whole sky chorus)
    const plainAt = new Date("2026-01-01T02:00:00Z");
    const trickAt = new Date("2026-01-05T18:00:00Z");

    const plainSnap = takeSnapshot(
      resolveMoment(jdFromDate(plainAt), lat, lon).entries,
      lat,
      lon,
    );
    const trickSnap = takeSnapshot(
      resolveMoment(jdFromDate(trickAt), lat, lon).entries,
      lat,
      lon,
    );

    const plainOrch = orchestrate(plainSnap.chord);
    const trickOrch = orchestrate(trickSnap.chord);

    expect(plainOrch.tone.register).toBe("plain-reading");
    expect(trickOrch.tone.register).toBe("trickster-challenge");
    expect(plainOrch.tone.register).not.toBe(trickOrch.tone.register);

    // Whole field votes — many contributors; decomposition keeps each testimony
    expect(plainSnap.chord.contributors.length).toBeGreaterThanOrEqual(8);
    expect(trickSnap.chord.contributors.length).toBeGreaterThanOrEqual(8);
    expect(plainOrch.fieldSize).toBe(plainSnap.chord.contributors.length);

    const decomp = decompose(plainSnap.chord);
    expect(decomp.length).toBe(plainSnap.chord.contributors.length);
    for (const row of decomp) {
      expect(row.entry.name.length).toBeGreaterThan(0);
      expect(row.contributes.length).toBeGreaterThan(0);
    }

    const prov = provenance(plainSnap);
    expect(prov.measured.length + prov.celebrated.length).toBeGreaterThan(0);
    expect(prov.line).toMatch(/Computed from|celebrated through/);

    for (const chord of [plainSnap.chord, trickSnap.chord]) {
      const { user, system } = orchestratedPrompt(chord);
      expect(user).not.toMatch(/\bLeo\b|\bMars\b|\bSaturn\b/);
      expect(user).toMatch(/REGISTER:/);
      expect(system).toMatch(/Name NO system/i);
    }
  });
});
