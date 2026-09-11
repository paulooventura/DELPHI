import { describe, expect, it } from "vitest";
import {
  NOW_CHORD,
  lerp,
  pitchHz,
  voiceFromSpeed,
} from "./heliodromeChordConfig";
import { LANE_TICK_PERIOD_S, orderStringsForTest } from "./heliodromeChord";
import type { OrreryLaneState } from "./lore/orreryLanes";

function fakeLane(id: OrreryLaneState["id"], index = 0): OrreryLaneState {
  return {
    id,
    name: id,
    cycle: "test",
    tier: "display",
    speedT: 0.5,
    index,
    progress: 0.2,
    cells: [{ id: "a", label: "a" }, { id: "b", label: "b" }],
    activeLabel: "a",
  };
}

describe("NOW-Chord tuning", () => {
  it("pitch walks the scale then octave-ups", () => {
    const n = NOW_CHORD.SCALE.length;
    expect(pitchHz(0)).toBeCloseTo(NOW_CHORD.ROOT_HZ, 5);
    expect(pitchHz(1)).toBeCloseTo(NOW_CHORD.ROOT_HZ * 2 ** (NOW_CHORD.SCALE[1]! / 12), 5);
    expect(pitchHz(n)).toBeCloseTo(NOW_CHORD.ROOT_HZ * 2, 5);
  });

  it("speed mix law: faster quieter darker wider continuous", () => {
    const slow = voiceFromSpeed(0, 3600);
    const fast = voiceFromSpeed(1, 0.01);
    expect(slow.gain).toBeGreaterThan(fast.gain);
    expect(fast.gain).toBeLessThanOrEqual(NOW_CHORD.WHIR_CEILING_GAIN);
    expect(slow.decayS).toBeGreaterThan(fast.decayS);
    expect(slow.lowpassHz).toBeGreaterThan(fast.lowpassHz);
    expect(fast.stereoWidth).toBeGreaterThan(slow.stereoWidth);
    expect(slow.model).toBe("pluck");
    expect(fast.model).toBe("whir");
  });

  it("lerp clamps", () => {
    expect(lerp(0, 10, -1)).toBe(0);
    expect(lerp(0, 10, 2)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it("orders fastest first with high pitch by default", () => {
    const ordered = orderStringsForTest([
      fakeLane("year"),
      fakeLane("sec"),
      fakeLane("ms"),
    ]);
    expect(ordered.map(r => r.lane.id)).toEqual(["ms", "sec", "year"]);
    expect(ordered[0]!.s).toBe(1);
    expect(ordered[0]!.pitch).toBeGreaterThan(ordered[2]!.pitch);
    expect(ordered[0]!.params.model).toBe("whir");
    expect(ordered[2]!.params.model).toBe("pluck");
  });

  it("has tick periods for every orrery lane id", () => {
    expect(LANE_TICK_PERIOD_S.helek).toBeCloseTo(10 / 3, 5);
    expect(LANE_TICK_PERIOD_S.sec).toBe(1);
    expect(LANE_TICK_PERIOD_S.ms).toBe(0.001);
  });
});
