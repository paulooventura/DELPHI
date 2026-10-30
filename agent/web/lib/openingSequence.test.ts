import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  afterClip,
  afterGuide,
  hasSeenPilgrimGuide,
  LAST_CLIP,
  markPilgrimGuideSeen,
  OPENING_CLIPS,
  PILGRIM_GUIDE_KEY,
  requestPilgrimGuideReplay,
  pilgrimGuideWanted,
  skipTo,
  type OpeningPlan,
  type OpeningStep,
} from "./openingSequence";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

/** Play the opening start to finish with no taps; returns every step taken. */
function walk(plan: OpeningPlan): OpeningStep[] {
  const steps: OpeningStep[] = [{ kind: "clip", idx: 0 }];
  for (let guard = 0; guard < 20; guard++) {
    const cur = steps[steps.length - 1]!;
    if (cur.kind === "end") return steps;
    steps.push(cur.kind === "clip" ? afterClip(cur.idx, plan) : afterGuide(cur.idx, plan));
  }
  throw new Error("opening never ends");
}

describe("opening sequence", () => {
  it("is Historical, Pythia, Stairs, then the cake offering", () => {
    expect(OPENING_CLIPS).toEqual(["historical", "pythia", "stairs", "void"]);
    expect(LAST_CLIP).toBe(3);
  });

  it("returning open with Allow already chosen: all four films, then Enter", () => {
    expect(walk({ guide: false, needsGate: false })).toEqual([
      { kind: "clip", idx: 0 },
      { kind: "clip", idx: 1 },
      { kind: "clip", idx: 2 },
      { kind: "clip", idx: 3 },
      { kind: "end", end: "enter" },
    ]);
  });

  it("Allow still needed: the cake still plays, then the gate", () => {
    const steps = walk({ guide: false, needsGate: true });
    expect(steps.filter(s => s.kind === "clip")).toHaveLength(4);
    expect(steps.at(-1)).toEqual({ kind: "end", end: "gate" });
  });

  it("first-ever open with the guide: a box after each film, in order, then the gate", () => {
    expect(walk({ guide: true, needsGate: true })).toEqual([
      { kind: "clip", idx: 0 },
      { kind: "guide", idx: 0 },
      { kind: "clip", idx: 1 },
      { kind: "guide", idx: 1 },
      { kind: "clip", idx: 2 },
      { kind: "guide", idx: 2 },
      { kind: "clip", idx: 3 },
      { kind: "guide", idx: 3 },
      { kind: "end", end: "gate" },
    ]);
  });

  it("a skip always lands on the cake's last frame (gate or Enter), never straight home", () => {
    expect(skipTo({ guide: true, needsGate: true })).toEqual({ kind: "end", end: "gate" });
    expect(skipTo({ guide: false, needsGate: false })).toEqual({ kind: "end", end: "enter" });
  });
});

describe("pilgrim guide flag", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows on the first-ever open and not after it is seen", () => {
    expect(hasSeenPilgrimGuide()).toBe(false);
    expect(pilgrimGuideWanted()).toBe(true);
    markPilgrimGuideSeen();
    expect(localStorage.getItem(PILGRIM_GUIDE_KEY)).toBe("seen");
    expect(pilgrimGuideWanted()).toBe(false);
  });

  it("About's replay shows it again until that walk is finished or skipped", () => {
    markPilgrimGuideSeen();
    requestPilgrimGuideReplay();
    expect(pilgrimGuideWanted()).toBe(true);
    expect(pilgrimGuideWanted()).toBe(true);
    markPilgrimGuideSeen();
    expect(pilgrimGuideWanted()).toBe(false);
  });
});
