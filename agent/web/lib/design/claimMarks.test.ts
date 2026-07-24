import { describe, expect, it } from "vitest";
import { CLAIM_MARKS, claimMarkStyle, type ClaimMarkStyle } from "./claimMarks";
import type { ClaimKind } from "../worldCycles/types";

const KINDS: ClaimKind[] = ["measurement", "convention", "interpretation"];
const PROPS: (keyof ClaimMarkStyle)[] = [
  "hasTicks",
  "hasDividers",
  "boundaryDash",
  "inset",
  "boundaryColor",
  "markOpacity",
];

describe("claim mark tokens", () => {
  it("each pair of ClaimKinds differs on >= 2 independent properties", () => {
    // Two matters: one property means a single token edit could silently collapse
    // the distinction. This is the regression guard on the whole (b) decision.
    for (let i = 0; i < KINDS.length; i++) {
      for (let j = i + 1; j < KINDS.length; j++) {
        const a = CLAIM_MARKS[KINDS[i]!];
        const b = CLAIM_MARKS[KINDS[j]!];
        const diffs = PROPS.filter((p) => a[p] !== b[p]);
        expect(diffs.length, `${KINDS[i]} vs ${KINDS[j]}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("opacity is identical across kinds — a different claim is not a lesser one", () => {
    const opacities = new Set(KINDS.map((k) => CLAIM_MARKS[k].markOpacity));
    expect(opacities.size).toBe(1);
  });

  it("measurement graduates, convention divides — mutually exclusive marks", () => {
    expect(CLAIM_MARKS.measurement.hasTicks).toBe(true);
    expect(CLAIM_MARKS.measurement.hasDividers).toBe(false);
    expect(CLAIM_MARKS.convention.hasDividers).toBe(true);
    expect(CLAIM_MARKS.convention.hasTicks).toBe(false);
  });

  it("interpretation is the only detached register (dashed boundary + inset)", () => {
    expect(CLAIM_MARKS.interpretation.boundaryDash).not.toBe("");
    expect(CLAIM_MARKS.interpretation.inset).toBeGreaterThan(0);
    expect(CLAIM_MARKS.interpretation.hasTicks).toBe(false);
    expect(CLAIM_MARKS.interpretation.hasDividers).toBe(false);
    for (const k of ["measurement", "convention"] as const) {
      expect(CLAIM_MARKS[k].boundaryDash).toBe("");
      expect(CLAIM_MARKS[k].inset).toBe(0);
    }
  });

  it("style resolves from claim alone; unlabeled rings fall back to convention", () => {
    expect(claimMarkStyle("interpretation")).toEqual(CLAIM_MARKS.interpretation);
    expect(claimMarkStyle(undefined)).toEqual(CLAIM_MARKS.convention);
  });
});
