import { describe, expect, it } from "vitest";
import { buildPrompt, compose, distillTemplate } from "./compose";
import { byId } from "./qualia";

describe("chorus distillation — no tradition names on the home phrase", () => {
  const active = [
    byId("wz-leo")!,
    byId("cz-horse")!,
    byId("el-fire")!,
  ].filter(Boolean);

  it("distillTemplate weaves shared qualities — never Leo/Horse/Fire labels", () => {
    const chord = compose(active);
    const phrase = distillTemplate(chord);
    expect(phrase.endsWith(".")).toBe(true);
    expect(phrase).not.toMatch(/leo|horse|fire|western|chinese/i);
    expect(phrase).not.toMatch(/wrestling with/i);
    // Leo + Fire both carry "radiant" — that shared quality should surface.
    expect(phrase.toLowerCase()).toMatch(/radiant/);
  });

  it("buildPrompt user payload never lists tradition entry names", () => {
    const chord = compose(active);
    const { system, user } = buildPrompt(chord);
    expect(system).toMatch(/standing wave|chorus/i);
    expect(system).toMatch(/Do NOT name any system/i);
    expect(user).not.toMatch(/\bLeo\b/);
    expect(user).not.toMatch(/\bHorse\b/);
    expect(user).toMatch(/Name no tradition/);
  });

  it("color lean retunes the phrase without naming the color", () => {
    const chord = compose(active);
    const base = distillTemplate(chord);
    const yellow = distillTemplate(chord, { colorLean: "Yellow" });
    const blue = distillTemplate(chord, { colorLean: "Blue" });
    expect(yellow).not.toMatch(/\byellow\b|\bred\b|\bblue\b|\bwhite\b/i);
    expect(blue).not.toMatch(/\byellow\b|\bred\b|\bblue\b|\bwhite\b/i);
    // Different natal colors must produce different street weather.
    expect(yellow).not.toBe(blue);
    expect(yellow).not.toBe(base);
    expect(blue).not.toBe(base);
    expect(yellow.toLowerCase()).toMatch(/radiant|warm|active|light|outward|charged|bright|flowering/);
    expect(blue.toLowerCase()).toMatch(/deep|dreaming|intuitive|expansive|transformative|healing|playful/);
  });

  it("buildPrompt color lean never asks the model to name Red/White/Blue/Yellow", () => {
    const chord = compose(active);
    const { system, user } = buildPrompt(chord, { colorLean: "Red" });
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
    // Held words must surface in the street phrase (lead or undercurrent).
    expect(lean.toLowerCase()).toMatch(/still/);
    expect(lean.toLowerCase()).toMatch(/threshold/);
  });

  it("buildPrompt cast lean hints without tradition names", () => {
    const chord = compose(active);
    const { user } = buildPrompt(chord, { castLean: ["still", "threshold"] });
    expect(user).toMatch(/Held cast|undercurrent/i);
    expect(user).toMatch(/still|threshold/);
    expect(user).not.toMatch(/tarot|the fool/i);
  });
});
