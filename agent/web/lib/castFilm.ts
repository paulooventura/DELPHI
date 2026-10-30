/**
 * Cast ritual films: lean graded copies (cast-<id>-g.mp4, the ritual's filter and grade baked in)
 * and a poster frame. Opening a tradition's picker warms its film into memory, so the ritual
 * plays from the device instead of streaming while it plays.
 */
import { DELPHI_BUILD } from "./buildStamp";
import { CAST_RITUAL_VIDEO } from "./lore/cast";

export type CastFilm = { video: string; poster: string };

export function castFilmKey(system: string): string {
  if (CAST_RITUAL_VIDEO[system]) return system;
  if (system.startsWith("orisha")) return "orisha-cast";
  if (system.startsWith("iching")) return "iching-hexagram";
  if (system.startsWith("tarot")) return "tarot";
  return system;
}

export function castFilm(system: string): CastFilm | null {
  const raw = CAST_RITUAL_VIDEO[castFilmKey(system)];
  if (!raw) return null;
  const base = raw.replace(/\.mp4$/, "-g");
  return { video: `${base}.mp4?v=${DELPHI_BUILD}`, poster: `${base}.jpg?v=${DELPHI_BUILD}` };
}

const warming = new Map<string, Promise<string | null>>();
const warmed = new Map<string, string>();

/** Start (or join) the download of this system's film; resolves to a local blob URL, or null. */
export function warmCastFilm(system: string): Promise<string | null> {
  const film = castFilm(system);
  if (!film) return Promise.resolve(null);
  const hit = warming.get(film.video);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await fetch(film.video);
      if (!res.ok) return null;
      const url = URL.createObjectURL(await res.blob());
      warmed.set(film.video, url);
      return url;
    } catch {
      warming.delete(film.video);
      return null;
    }
  })();
  warming.set(film.video, p);
  return p;
}

/** The local copy if its download has finished. */
export function warmedCastFilm(system: string): string | undefined {
  const film = castFilm(system);
  return film ? warmed.get(film.video) : undefined;
}
