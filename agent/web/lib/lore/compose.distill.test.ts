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
});
