import { afterEach, describe, expect, it, vi } from "vitest";
import { castFilm, castFilmKey, warmCastFilm, warmedCastFilm } from "./castFilm";

describe("castFilm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps every system to its lean graded copy and poster", () => {
    expect(castFilm("tarot")?.video).toMatch(/^\/cast-tarot-g\.mp4\?v=/);
    expect(castFilm("tarot-major")?.video).toMatch(/^\/cast-tarot-g\.mp4\?v=/);
    expect(castFilm("rune-cast")?.video).toMatch(/^\/cast-runes-g\.mp4\?v=/);
    expect(castFilm("orisha-odu")?.poster).toMatch(/^\/cast-orisha-g\.jpg\?v=/);
    expect(castFilm("iching-hexagram")?.video).toMatch(/^\/cast-iching-g\.mp4\?v=/);
  });

  it("falls back by family and returns null for systems without a film", () => {
    expect(castFilmKey("orisha-names")).toBe("orisha-cast");
    expect(castFilmKey("iching-yarrow")).toBe("iching-hexagram");
    expect(castFilm("no-such-system")).toBeNull();
  });

  it("downloads a film once and hands back the local copy", async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(["x"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: () => "blob:film" }));
    const a = warmCastFilm("orisha-cast");
    const b = warmCastFilm("orisha-odu");
    expect(await a).toBe("blob:film");
    expect(await b).toBe("blob:film");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warmedCastFilm("orisha-cast")).toBe("blob:film");
  });
});
