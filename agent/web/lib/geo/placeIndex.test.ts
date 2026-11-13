import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fold, nearestPlace, searchPlaceIndex, type PlaceData } from "./placeIndex";

const data = JSON.parse(readFileSync(join(__dirname, "../../public/geo/places.json"), "utf-8")) as PlaceData;

describe("offline place search (GeoNames)", () => {
  it("folds accents and case", () => {
    expect(fold("São Paulo")).toBe("sao paulo");
  });

  it("finds a city by the start of its name, biggest first", () => {
    const hits = searchPlaceIndex(data, "nashv");
    expect(hits[0]!.label).toContain("Nashville");
    expect(hits[0]!.label).toContain("Tennessee");
  });

  it("narrows by region or country after a comma", () => {
    const hits = searchPlaceIndex(data, "paris, texas");
    expect(hits[0]!.admin1).toBe("Texas");
    const fr = searchPlaceIndex(data, "paris, france");
    expect(fr[0]!.country).toBe("France");
  });

  it("matches without accents, and a trailing country without a comma", () => {
    expect(searchPlaceIndex(data, "sao paulo")[0]!.country).toBe("Brazil");
    expect(searchPlaceIndex(data, "sao paulo brazil")[0]!.country).toBe("Brazil");
  });

  it("names the nearest place to a point", () => {
    expect(nearestPlace(data, 36.1627, -86.7816)!.name).toBe("Nashville");
    expect(searchPlaceIndex(data, "x")).toEqual([]);
  });
});
