import { describe, expect, it } from "vitest";
import { metSymbolToWmo, metToWeather } from "./metNorway";

describe("MET Norway weather", () => {
  it("maps MET symbols onto the app's weather codes", () => {
    expect(metSymbolToWmo("clearsky_day")).toBe(0);
    expect(metSymbolToWmo("fair_night")).toBe(1);
    expect(metSymbolToWmo("cloudy")).toBe(3);
    expect(metSymbolToWmo("lightrainshowers_day")).toBe(80);
    expect(metSymbolToWmo("heavyrain")).toBe(65);
    expect(metSymbolToWmo("snow")).toBe(73);
    expect(metSymbolToWmo("rainandthunder")).toBe(95);
    expect(metSymbolToWmo("fog")).toBe(45);
  });

  it("builds current conditions and local hours, wind in km/h, no made-up rain chance", () => {
    const at = (iso: string, sym: string, t: number) => ({
      time: iso,
      data: {
        instant: { details: { air_temperature: t, wind_speed: 5, cloud_area_fraction: 40, air_pressure_at_sea_level: 1012 } },
        next_1_hours: { summary: { symbol_code: sym }, details: { precipitation_amount: 0 } },
      },
    });
    const json = { properties: { timeseries: [at("2026-11-12T18:00:00Z", "fair_day", 14), at("2026-11-12T19:00:00Z", "rain", 12)] } };
    const w = metToWeather(json, { lat: 36.16, lon: -86.78, timeZone: "America/Chicago", nowMs: Date.parse("2026-11-12T18:30:00Z") })!;
    expect(w.tempC).toBe(14);
    expect(w.windKmh).toBe(18);
    expect(w.pressureHpa).toBe(1012);
    expect(w.precipProb).toBeNull();
    expect(w.hourly![12]!.tempC).toBe(14);
    expect(w.hourly![13]!.condition).toBe("Rain");
    expect(w.hourly).toHaveLength(24);
  });

  it("returns nothing for an empty answer", () => {
    expect(metToWeather({}, { lat: 0, lon: 0, timeZone: "UTC" })).toBeUndefined();
  });
});
