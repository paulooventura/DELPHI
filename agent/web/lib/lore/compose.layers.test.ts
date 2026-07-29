import { describe, expect, it } from "vitest";
import { composeLayers, distillTemplate, layerPrompt } from "./compose";
import { byId } from "./qualia";

describe("layered reading — invariants 9–10", () => {
  const moment = [
    byId("wz-leo")!,
    byId("cz-horse")!,
    byId("el-fire")!,
  ].filter(Boolean);

  // Willow pulls inward/lunar; Ogun adds cast force — distinct from fire/Leo sky.
  const natal = [byId("ct-willow")!].filter(Boolean);
  const drawn = [byId("or-ogun")!].filter(Boolean);

  it("9 — Layer 0 is identical and computed-only even if birth/cast are passed", () => {
    const polluted = [...moment, ...natal, ...drawn];
    const a = composeLayers(polluted, { natal, drawn });
    const b = composeLayers(moment, {});

    const layer0a = a.layers.find(l => l.id === "moment")!;
    const layer0b = b.layers.find(l => l.id === "moment")!;

    expect(layer0a.entries.every(e => e.nature === "computed")).toBe(true);
    expect(layer0a.entries.map(e => e.id).sort()).toEqual(
      layer0b.entries.map(e => e.id).sort(),
    );
    expect(distillTemplate(layer0a.chord)).toBe(distillTemplate(layer0b.chord));
    expect(layer0a.entries.some(e => e.nature === "cast" || e.nature === "birth")).toBe(
      false,
    );
  });

  it("10 — natal yields Layer 1 without changing Layer 0; draw yields Layer 2; clear restores", () => {
    const base = composeLayers(moment, {});
    const withNatal = composeLayers(moment, { natal });
    const withDraw = composeLayers(moment, { natal, drawn });
    const cleared = composeLayers(moment, { natal });

    const l0 = (r: ReturnType<typeof composeLayers>) =>
      r.layers.find(l => l.id === "moment")!;
    const phrase0 = distillTemplate(l0(base).chord);

    expect(distillTemplate(l0(withNatal).chord)).toBe(phrase0);
    expect(distillTemplate(l0(withDraw).chord)).toBe(phrase0);

    expect(withNatal.layers.map(l => l.id)).toEqual(["moment", "through-you"]);
    expect(withDraw.layers.map(l => l.id)).toEqual([
      "moment",
      "through-you",
      "with-drawn",
    ]);

    const throughYou = withNatal.layers.find(l => l.id === "through-you")!;
    const drawnLayer = withDraw.layers.find(l => l.id === "with-drawn")!;
    expect(throughYou.entries.map(e => e.id)).toContain("ct-willow");
    expect(throughYou.added.map(e => e.id)).toEqual(["ct-willow"]);
    expect(throughYou.chord.contributors.length).toBeGreaterThan(
      l0(withNatal).chord.contributors.length,
    );
    expect(drawnLayer.added.map(e => e.id)).toEqual(["or-ogun"]);
    expect(drawnLayer.chord.activeQualities).not.toEqual(
      throughYou.chord.activeQualities,
    );

    // Clearing the draw returns exactly the prior through-you phrase.
    expect(distillTemplate(cleared.layers.find(l => l.id === "through-you")!.chord)).toBe(
      distillTemplate(throughYou.chord),
    );
    expect(cleared.layers.some(l => l.id === "with-drawn")).toBe(false);
    void phrase0;
  });

  it("layerPrompt distills the active layer with the chorus voice", () => {
    const reading = composeLayers(moment, { natal, drawn, active: "moment" });
    const { system, user } = layerPrompt(reading);
    expect(system).toMatch(/standing wave|chorus/i);
    expect(user).not.toMatch(/\bLeo\b/);
    expect(reading.active).toBe("moment");

    const deep = composeLayers(moment, { natal, drawn });
    expect(deep.active).toBe("with-drawn");
  });
});
