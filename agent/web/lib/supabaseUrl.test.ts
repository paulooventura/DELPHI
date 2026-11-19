import { describe, expect, it } from "vitest";
import { PNEUMA_SUPABASE_URL, supabaseUrl } from "./supabaseUrl";

describe("Supabase address", () => {
  it("keeps a valid setting, trimmed", () => {
    expect(supabaseUrl(' "https://abc.supabase.co/" ')).toBe("https://abc.supabase.co");
  });
  it("falls back to Pneuma's project when the setting is missing or not an https address", () => {
    expect(supabaseUrl(undefined)).toBe(PNEUMA_SUPABASE_URL);
    expect(supabaseUrl("ookjqagkelkoggpqwbti")).toBe(PNEUMA_SUPABASE_URL);
    expect(supabaseUrl("eyJhbGciOi")).toBe(PNEUMA_SUPABASE_URL);
  });
});
