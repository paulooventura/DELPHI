import { describe, expect, it, vi } from "vitest";
import { speak } from "./phrase";
import { compose, orchestrate, takeSnapshot } from "./compose";
import { resolveMoment } from "./resolveMoment";
import { jdFromDate } from "../phase/timeResolution";
import { byId, type QualiaEntry } from "./qualia";
import { phraseForMoment } from "./distillPhrase";

function mk(
  name: string,
  system: string,
  polarities: QualiaEntry["polarities"],
): QualiaEntry {
  return {
    id: `test-${name}`,
    system,
    name,
    glyph: "·",
    qualities: ["test"],
    polarities,
    source: "test",
    claim: "interpretation",
    nature: "computed",
    observes: "moment",
    honesty: "render",
    tier: "celebrated",
    origin: ["test"],
    observed: name,
  } as QualiaEntry;
}

describe("Addendum 5 — local speak() (invariant 13)", () => {
  it("speak is sync, local, and never calls fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("network should not be touched");
    });

    const chord = compose([
      byId("wz-leo")!,
      byId("el-fire")!,
      byId("mp-full")!,
    ].filter(Boolean));

    const phrase = speak(chord);
    expect(phrase.length).toBeGreaterThan(12);
    expect(phrase).toMatch(/[.!?]$/);
    expect(phrase).not.toMatch(/leo|fire|anthropic|api key/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("same chord → same phrase; different fields → different phrases", () => {
    const bright = compose([
      mk("Bright", "western-zodiac", {
        light: 0.85, warm: 0.7, gentle: 0.5, steady: 0.55,
      }),
      mk("Settled", "moon-phase", {
        light: 0.75, warm: 0.55, gentle: 0.4, steady: 0.6,
      }),
      mk("Open", "element", {
        light: 0.7, warm: 0.6, outward: 0.5, gentle: 0.35,
      }),
    ]);
    const dark = compose([
      mk("Dark", "moon-phase", {
        light: -0.8, warm: -0.5, gentle: -0.6, binding: 0.7,
      }),
      mk("Fierce", "western-zodiac", {
        light: -0.5, warm: -0.3, gentle: -0.7, binding: -0.75, active: 0.6,
      }),
      mk("Cool", "element", {
        light: -0.55, warm: -0.65, gentle: -0.4, binding: 0.55,
      }),
      mk("MarsHour", "planetary-hour", {
        light: -0.4, gentle: -0.7, active: 0.8,
      }),
    ]);

    expect(speak(bright)).toBe(speak(bright));
    expect(speak(dark)).toBe(speak(dark));
    expect(speak(bright)).not.toBe(speak(dark));

    expect(orchestrate(bright).tone.register).toBe("warm-witness");
    expect(orchestrate(dark).tone.register).toBe("trickster-challenge");
    expect(speak(dark).toLowerCase()).toMatch(
      /what will you|your move|which hand|walk through|act like|dealt this/,
    );
  });

  it("reader can change the mouth without changing the chord", () => {
    const chord = compose([
      mk("Bright", "western-zodiac", {
        light: 0.85, warm: 0.7, gentle: 0.5, steady: 0.55,
      }),
      mk("Settled", "moon-phase", {
        light: 0.75, warm: 0.55, gentle: 0.4, steady: 0.6,
      }),
    ]);
    const field = speak(chord, { voice: "field" });
    const dare = speak(chord, { voice: "trickster-challenge" });
    expect(field).not.toBe(dare);
    expect(dare.toLowerCase()).toMatch(/your move|walk through|act like/);
    expect(field).not.toMatch(/Leo|Horse/i);
  });

  it("live phrases name weather and challenge the reader — never tradition labels", () => {
    const snap = takeSnapshot(
      resolveMoment(jdFromDate(new Date("2026-07-29T23:45:00Z")), 36.16, -86.78)
        .entries,
      36.16,
      -86.78,
    );
    const phrase = speak(snap.chord);
    expect(phrase.length).toBeGreaterThan(12);
    expect(phrase).not.toMatch(/\b(Leo|Mars|Saturn|Horse|nakshatra|wuku)\b/i);
    // Challenge turn: second-person dare
    expect(phrase.toLowerCase()).toMatch(
      /\byou\b|\byour\b|choose|name which|see the split|sit with|turn it|stay with|don't|will you|prove|challenge|decide|plant one|your move|which hand|walk through|act like|what will you|what were you/,
    );
  });

  it("every register ends as a challenge to the user", () => {
    const chords = [
      compose([
        mk("Bright", "western-zodiac", {
          light: 0.85, warm: 0.7, gentle: 0.5, steady: 0.55,
        }),
        mk("Settled", "moon-phase", {
          light: 0.75, warm: 0.55, gentle: 0.4, steady: 0.6,
        }),
      ]),
      compose([
        mk("Dark", "moon-phase", {
          light: -0.8, warm: -0.5, gentle: -0.6, binding: 0.7,
        }),
        mk("Fierce", "western-zodiac", {
          light: -0.5, warm: -0.3, gentle: -0.7, binding: -0.75, active: 0.6,
        }),
        mk("Cool", "element", {
          light: -0.55, warm: -0.65, gentle: -0.4, binding: 0.55,
        }),
        mk("MarsHour", "planetary-hour", {
          light: -0.4, gentle: -0.7, active: 0.8,
        }),
      ]),
    ];
    for (const chord of chords) {
      const phrase = speak(chord);
      expect(phrase.toLowerCase()).toMatch(
        /\byou\b|\byour\b|will you|don't |choose|pick |prove|challenge|your move|which hand|walk through|act like|what will you|decide|plant |name which|see the split|sit with|turn it|stay with|meet it/,
      );
    }
  });

  it("phraseForMoment works with network mocked offline and no API key", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("offline"),
    );
    delete process.env.ANTHROPIC_API_KEY;

    const snap = takeSnapshot(
      resolveMoment(jdFromDate(new Date("2026-07-29T23:45:00Z")), 36.16, -86.78)
        .entries,
      36.16,
      -86.78,
    );
    const { phrase, source } = phraseForMoment(
      snap.chord,
      "2026-07-29",
      36.16,
      -86.78,
    );
    expect(source).toMatch(/local|cache/);
    expect(phrase.length).toBeGreaterThan(12);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("live Nashville moments produce distinct local sentences", () => {
    const lat = 36.16;
    const lon = -86.78;
    const times = [
      "2026-07-29T23:45:00Z", // dusk
      "2026-07-30T08:00:00Z", // night
      "2026-07-30T11:30:00Z", // dawn-ish
      "2026-07-29T17:00:00Z", // midday
    ];
    const phrases = times.map(iso => {
      const snap = takeSnapshot(
        resolveMoment(jdFromDate(new Date(iso)), lat, lon).entries,
        lat,
        lon,
      );
      return speak(snap.chord);
    });
    for (const p of phrases) {
      expect(p.length).toBeGreaterThan(10);
      expect(p).not.toMatch(/\b(Leo|Mars|Saturn|nakshatra)\b/);
    }
    // At least two distinct readings across the four fields
    expect(new Set(phrases).size).toBeGreaterThanOrEqual(2);
  });
});
