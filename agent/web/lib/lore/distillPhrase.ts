/**
 * Home-phrase helpers — local speak() only (Addendum 5).
 * No fetch, no API key. Network-disabled still renders a phrase.
 */

import type { Composition, DistillOptions } from "./compose";
import { speak } from "./phrase";
import type { TribeColor } from "./colorLean";

export function phraseCacheKey(
  civilYmd: string,
  lat: number,
  lon: number,
  colorLean?: TribeColor | null,
  castLeanKey = "none",
  layerKey = "moment",
): string {
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  // v9: oracle speak() — weather + hinge + dare.
  const lean = colorLean ?? "none";
  return `delphi-phrase:v9:${civilYmd}:${rLat}:${rLon}:${layerKey}:${lean}:${castLeanKey}`;
}

export function readCachedPhrase(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeCachedPhrase(key: string, phrase: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, phrase);
  } catch {
    /* quota — ignore */
  }
}

export type PhraseResult = {
  phrase: string;
  source: "cache" | "local";
};

/**
 * Sync path — speak(chord) locally. Optional cache for remounts in the same day.
 * DistillOptions reserved for personal lean (unused by speak today).
 */
export function phraseForMoment(
  chord: Composition,
  civilYmd: string,
  lat: number,
  lon: number,
  opts?: DistillOptions,
  layerKey = "moment",
): PhraseResult {
  void opts;
  const castKey = (opts?.castLean ?? []).slice(0, 6).join("+") || "none";
  const key = phraseCacheKey(civilYmd, lat, lon, opts?.colorLean, castKey, layerKey);
  const cached = readCachedPhrase(key);
  if (cached && cached.length > 8) {
    return { phrase: cached, source: "cache" };
  }
  const phrase = speak(chord);
  writeCachedPhrase(key, phrase);
  return { phrase, source: "local" };
}
