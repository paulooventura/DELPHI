/**
 * Home-phrase helpers — local speak() first, then optional phrase brain.
 * Network-disabled still renders a phrase. Birth data never leaves the device.
 */

import type { Composition, DistillOptions } from "./compose";
import { speak } from "./phrase";
import { toPhraseBrainPayload } from "./phraseBrain";
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
  const lean = colorLean ?? "none";
  // v13: hinge+hour local line; brain upgrade cached under the same key.
  return `delphi-phrase:v13:${civilYmd}:${rLat}:${rLon}:${layerKey}:${lean}:${castLeanKey}`;
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

export function phraseCacheKeyFrom(
  civilYmd: string,
  lat: number,
  lon: number,
  opts?: DistillOptions,
  layerKey = "moment",
): string {
  const castKey = (opts?.castLean ?? []).slice(0, 6).join("+") || "none";
  return phraseCacheKey(civilYmd, lat, lon, opts?.colorLean, castKey, layerKey);
}

export type PhraseResult = {
  phrase: string;
  source: "cache" | "local";
};

/**
 * Sync path — speak(chord) locally. Optional cache for remounts in the same day.
 */
export function phraseForMoment(
  chord: Composition,
  civilYmd: string,
  lat: number,
  lon: number,
  opts?: DistillOptions,
  layerKey = "moment",
): PhraseResult {
  const key = phraseCacheKeyFrom(civilYmd, lat, lon, opts, layerKey);
  const cached = readCachedPhrase(key);
  if (cached && cached.length > 8) {
    return { phrase: cached, source: "cache" };
  }
  return { phrase: speak(chord, opts), source: "local" };
}

/**
 * Ask the server to voice the chord. Payload is axis math only — no birth PII.
 * Returns null on offline / no key / reject so the caller keeps the local line.
 */
export async function requestPhraseBrain(
  chord: Composition,
  opts?: DistillOptions,
  init?: { signal?: AbortSignal },
): Promise<{ phrase: string; source: string } | null> {
  try {
    const res = await fetch("/api/phrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPhraseBrainPayload(chord, opts)),
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(16000)])
        : AbortSignal.timeout(16000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { phrase?: string; source?: string };
    if (typeof json.phrase === "string" && json.phrase.length > 12) {
      return { phrase: json.phrase, source: json.source ?? "brain" };
    }
    return null;
  } catch {
    return null;
  }
}
