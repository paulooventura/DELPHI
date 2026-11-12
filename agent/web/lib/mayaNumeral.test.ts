import { describe, expect, it } from "vitest";
import { mayaNumeralParts } from "./mayaNumeral";

describe("Maya bar-and-dot numerals", () => {
  it("a dot is one, a bar is five", () => {
    expect(mayaNumeralParts(1)).toEqual({ bars: 0, dots: 1 });
    expect(mayaNumeralParts(5)).toEqual({ bars: 1, dots: 0 });
    expect(mayaNumeralParts(13)).toEqual({ bars: 2, dots: 3 });
    expect(mayaNumeralParts(19)).toEqual({ bars: 3, dots: 4 });
  });
});
