import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  compose,
  distillTemplate,
  orchestratedPrompt,
} from "./compose";
import { byId } from "./qualia";

describe("chorus distillation — no tradition names on the home phrase", () => {
  const active = [
    byId("wz-leo")!,
    byId("cz-horse")!,
    byId("el-fire")!,
  ].filter(Boolean);

  it("distillTemplate is noun-based & grammatical — never Leo/Horse/Fire labels", () => {
    const chord = compose(active);
    const phrase = distillTemplate(chord);
    expect(phrase.endsWith(".")).toBe(true);
    expect(phrase).not.toMatch(/leo|horse|fire|western|chinese/i);
    expect(phrase).not.toMatch(/wrestling with/i);
    // Noun-based weather — article + adjectives + noun (or tension clause).
    expect(phrase.toLowerCase()).toMatch(
      /\b(a|an)\b.+\b(warmth|brightness|drive|ascent|steadiness|openness|structure|tenderness|coolness|dimness|stillness|settling|restlessness|inwardness|dissolution|sharpness|quality)\b/,
    );
  });

  it("orchestratedPrompt never lists tradition entry names", () => {
    const chord = compose(active);
    const { system, user } = orchestratedPrompt(chord);
    expect(system).toMatch(/whole field|independent traditions/i);
    expect(system).toMatch(/Name NO system/i);
    expect(user).toMatch(/REGISTER:/);
    expect(user).toMatch(/ROOT/);
    expect(user).not.toMatch(/\bLeo\b/);
    expect(user).not.toMatch(/\bHorse\b/);
    expect(user).toMatch(/naming nothing/i);
  });

  it("color lean retunes the phrase without naming the color", () => {
    const chord = compose(active);
    const base = distillTemplate(chord);
    const yellow = distillTemplate(chord, { colorLean: "Yellow" });
    const blue = distillTemplate(chord, { colorLean: "Blue" });
    expect(yellow).not.toMatch(/\byellow\b|\bred\b|\bblue\b|\bwhite\b/i);
    expect(blue).not.toMatch(/\byellow\b|\bred\b|\bblue\b|\bwhite\b/i);
    expect(yellow).not.toBe(blue);
    expect(yellow).not.toBe(base);
    expect(blue).not.toBe(base);
  });

  it("orchestratedPrompt color lean never asks the model to name Red/White/Blue/Yellow", () => {
    const chord = compose(active);
    const { system, user } = orchestratedPrompt(chord, { colorLean: "Red" });
    expect(system).toMatch(/Never name colors/i);
    expect(user).toMatch(/Personal register/i);
    expect(user).not.toMatch(/\bRed\b/);
    expect(user).toMatch(/Do not name any color/);
  });

  it("cast lean visibly admits held qualities without naming the draw", () => {
    const chord = compose(active);
    const base = distillTemplate(chord);
    const lean = distillTemplate(chord, { castLean: ["still", "threshold"] });
    expect(lean.endsWith(".")).toBe(true);
    expect(lean).not.toMatch(/tarot|odu|hexagram|rune|the fool|cast/i);
    expect(lean).not.toBe(base);
    expect(lean.toLowerCase()).toMatch(/still/);
    expect(lean.toLowerCase()).toMatch(/threshold/);
  });

  it("buildPrompt cast lean hints without tradition names (legacy path)", () => {
    const chord = compose(active);
    const { user } = buildPrompt(chord, { castLean: ["still", "threshold"] });
    expect(user).toMatch(/Held cast|undercurrent/i);
    expect(user).toMatch(/still|threshold/);
    expect(user).not.toMatch(/tarot|the fool/i);
  });
});
