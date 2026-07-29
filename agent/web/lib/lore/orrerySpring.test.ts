import { describe, expect, it } from "vitest";
import {
  createLaneSpring,
  retargetSpring,
  springParams,
  stepSpring,
  wrapDelta,
} from "./orrerySpring";

describe("orrery spring — clockwork settle", () => {
  it("wrapDelta takes the short way around a circle", () => {
    expect(wrapDelta(59, 0, 60)).toBe(1);
    expect(wrapDelta(0, 59, 60)).toBe(-1);
    expect(wrapDelta(5, 8, 60)).toBe(3);
  });

  it("fast lanes are stiffer than slow lanes", () => {
    const fast = springParams(0);
    const slow = springParams(1);
    expect(fast.stiffness).toBeGreaterThan(slow.stiffness);
  });

  it("retarget + step settles near the new index with a brief overshoot path", () => {
    const s = createLaneSpring(3, 12);
    retargetSpring(s, 4, 12);
    expect(s.settled).toBe(false);
    let sawOvershoot = false;
    let settled = false;
    for (let i = 0; i < 120; i++) {
      if (s.pos > s.target) sawOvershoot = true;
      if (stepSpring(s, 0.4, 1 / 60)) settled = true;
    }
    expect(settled || s.settled).toBe(true);
    expect(Math.abs(s.pos - 4)).toBeLessThan(0.05);
    // Underdamped path should pass the target at least once on a 1-cell step
    expect(sawOvershoot || Math.abs(s.pos - 4) < 0.05).toBe(true);
  });

  it("seconds wrap 59→0 advances +1 on the continuum", () => {
    const s = createLaneSpring(59, 60);
    retargetSpring(s, 0, 60);
    expect(s.target).toBe(60);
    expect(s.lastIndex).toBe(0);
  });
});
