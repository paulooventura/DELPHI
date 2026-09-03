import { describe, expect, it } from "vitest";
import { compose } from "./compose";
import { byId } from "./qualia";
import {
  acceptDistilledPhrase,
  compositionFromPayload,
  parsePhraseBrainPayload,
  toPhraseBrainPayload,
} from "./phraseBrain";
import { orchestratedPrompt } from "./compose";

describe("phrase brain payload — no PII, no tradition names", () => {
  const chord = compose([
    byId("wz-leo")!,
    byId("cz-horse")!,
    byId("el-fire")!,
    byId("mp-full")!,
  ].filter(Boolean));

  it("strips entry names and keeps system ids for depth weights", () => {
    const payload = toPhraseBrainPayload(chord, {
      colorLean: "Red",
      castLean: ["still", "Leo", "threshold"],
    });
    const blob = JSON.stringify(payload);
    expect(blob).not.toMatch(/Leo|Horse|Full Moon/i);
    expect(blob).not.toMatch(/36\.16|-86\.78|"birth"/);
    expect(payload.axes.some(a => a.votes.some(v => v.system === "western-zodiac"))).toBe(true);
    expect(payload.castLean).toEqual(["still", "threshold"]);
    expect(payload.colorLean).toBe("Red");
    expect(payload.fieldSize).toBe(chord.contributors.length);
  });

  it("round-trip parse + composition still yields a nameless prompt", () => {
    const payload = toPhraseBrainPayload(chord, { colorLean: "Yellow" });
    const parsed = parsePhraseBrainPayload(payload);
    expect(parsed).not.toBeNull();
    const rebuilt = compositionFromPayload(parsed!);
    const { system, user } = orchestratedPrompt(rebuilt, { colorLean: parsed!.colorLean });
    expect(system + user).not.toMatch(/\b(Leo|Horse|Mars|nakshatra)\b/);
    expect(user).toMatch(/REGISTER:/);
    expect(user).toMatch(/The whole field/);
  });

  it("acceptDistilledPhrase rejects leaks and keeps a challenge", () => {
    expect(acceptDistilledPhrase("Leo is roaring today, ride the fire.")).toBeNull();
    expect(acceptDistilledPhrase("Good vibes only in the universe.")).toBeNull();
    const ok = acceptDistilledPhrase(
      "A brightness that will not sit still, with a restless current underneath. Meet it.",
    );
    expect(ok).toMatch(/Meet it/);
    const noDare = acceptDistilledPhrase(
      "A cool distance in the air, binding what was loose while the hour turns inward.",
    );
    expect(noDare).toMatch(/Your call/);
  });
});
