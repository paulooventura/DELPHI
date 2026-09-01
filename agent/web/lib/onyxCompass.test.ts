import { describe, expect, it } from "vitest";
import { COMPASS_DOORS, doorForAim, resolveCompassAim } from "./onyxCompass";

describe("onyx compass doors", () => {
  it("maps the four winds plus center", () => {
    expect(COMPASS_DOORS.up).toBe("sky");
    expect(COMPASS_DOORS.down).toBe("tonal");
    expect(COMPASS_DOORS.left).toBe("studies");
    expect(COMPASS_DOORS.right).toBe("orrery");
    expect(COMPASS_DOORS.center).toBe("you");
  });

  it("resolves drag direction past the aim threshold", () => {
    expect(resolveCompassAim(0, -80)).toBe("up");
    expect(resolveCompassAim(0, 80)).toBe("down");
    expect(resolveCompassAim(-80, 0)).toBe("left");
    expect(resolveCompassAim(80, 0)).toBe("right");
    expect(resolveCompassAim(4, -4)).toBe(null);
  });

  it("center is a tap, not a drag", () => {
    expect(doorForAim(null)).toBe(null);
    expect(doorForAim("center")).toBe("you");
  });
});
