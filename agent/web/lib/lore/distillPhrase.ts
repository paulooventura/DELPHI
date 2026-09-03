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
  // v14: mouth (voice/depth/brain) is part of the cache identity.
  return `delphi-phrase:v14:${civilYmd}:${rLat}:${rLon}:${layerKey}:${lean}:${castLeanKey}`;
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
  mouthKey = "field-deep-auto",
): string {
  const castKey = (opts?.castLean ?? []).slice(0, 6).join("+") || "none";
  const voice = opts?.voice ?? "field";
  return phraseCacheKey(
    civilYmd,
    lat,
    lon,
    opts?.colorLean,
    `${castKey}:${voice}:${mouthKey}`,
    layerKey,
  );
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
  mouthKey = "field-deep-auto",
): PhraseResult {
  const key = phraseCacheKeyFrom(civilYmd, lat, lon, opts, layerKey, mouthKey);
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
  init?: { signal?: AbortSignal; prefer?: "auto" | "anthropic" | "openai" | "gemini" },
): Promise<{ phrase: string; source: string } | null> {
  try {
    const res = await fetch("/api/phrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...toPhraseBrainPayload(chord, opts),
        prefer: init?.prefer ?? "auto",
      }),
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

export async function requestBrainAvailability(
  signal?: AbortSignal,
): Promise<{ anthropic: boolean; openai: boolean; gemini: boolean } | null> {
  try {
    const res = await fetch("/api/phrase", { signal: signal ?? AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { brains?: { anthropic?: boolean; openai?: boolean; gemini?: boolean } };
    const b = json.brains;
    if (!b) return null;
    return {
      anthropic: Boolean(b.anthropic),
      openai: Boolean(b.openai),
      gemini: Boolean(b.gemini),
    };
  } catch {
    return null;
  }
}
