import { describe, expect, it } from "vitest";
import { skyPeriodFromAltitude } from "./skyPeriod";

describe("skyPeriodFromAltitude", () => {
  it("is night below nautical twilight", () => {
    expect(skyPeriodFromAltitude(-18)).toBe("night");
    expect(skyPeriodFromAltitude(-12.1)).toBe("night");
  });

  it("is twilight around the horizon", () => {
    expect(skyPeriodFromAltitude(-6)).toBe("twilight");
    expect(skyPeriodFromAltitude(0)).toBe("twilight");
    expect(skyPeriodFromAltitude(5)).toBe("twilight");
  });

  it("is day once the sun is up", () => {
    expect(skyPeriodFromAltitude(6)).toBe("day");
    expect(skyPeriodFromAltitude(45)).toBe("day");
  });
});
