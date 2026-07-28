/**
 * Distilled moment phrase — model path with strict offline fallback.
 * Home must never block on the network.
 */

import type { Composition, DistillOptions } from "./compose";
import { buildPrompt, distillTemplate } from "./compose";
import type { TribeColor } from "./colorLean";

// Horoscope filler + calendar/tradition name-drops must never reach the street line.
const BANNED =
  /\b(energy|vibes|manifest|align|journey|universe|cosmic)\b|\b(leo|aries|taurus|gemini|cancer|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b|\b(rat|ox|tiger|rabbit|dragon|snake|horse|goat|sheep|monkey|rooster|dog|pig|boar)\b|\b(kin|tzolk'?in|tzolkin|hijri|hebrew|ethiopian|persian|dreamspell)\b|\brhythmic\s+seed\b|\b(red|white|blue|yellow)\s+(dragon|wind|night|seed|serpent|worldbridger|hand|star|moon|dog|monkey|human|skywalker|wizard|eagle|warrior|earth|mirror|storm|sun)\b/i;

export function phraseCacheKey(
  civilYmd: string,
  lat: number,
  lon: number,
  colorLean?: TribeColor | null,
): string {
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  // v3: optional natal color lean (local only) — separate cache per register.
  const lean = colorLean ?? "none";
  return `delphi-phrase:v3:${civilYmd}:${rLat}:${rLon}:${lean}`;
}

/** Accept only a single grounded sentence with no banned lexicon. */
export function acceptPhrase(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  // Reject multi-sentence (more than one terminal . ! ? before end)
  const body = t.replace(/[.!?]+$/, "");
  if (/[.!?]/.test(body)) return null;
  if (BANNED.test(t)) return null;
  if (t.length > 220) return null;
  return t.endsWith(".") || t.endsWith("!") || t.endsWith("?") ? t : `${t}.`;
}

export function fallbackPhrase(chord: Composition, opts?: DistillOptions): string {
  return distillTemplate(chord, opts);
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

/**
 * Resolve the day's phrase: cache → optional model → template fallback.
 * Always returns immediately with the template; upgrades via onUpdate when
 * a model sentence arrives and passes the gates.
 */
export async function fetchModelPhrase(
  chord: Composition,
  opts?: DistillOptions,
): Promise<string | null> {
  const { system, user } = buildPrompt(chord, opts);
  try {
    const res = await fetch("/api/lore/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { phrase?: string };
    return acceptPhrase(data.phrase ?? "") ;
  } catch {
    return null;
  }
}

export type PhraseResult = {
  phrase: string;
  source: "cache" | "template" | "model";
};

/**
 * Sync path for first paint — never awaits the network.
 */
export function phraseForMoment(
  chord: Composition,
  civilYmd: string,
  lat: number,
  lon: number,
  opts?: DistillOptions,
): PhraseResult {
  const key = phraseCacheKey(civilYmd, lat, lon, opts?.colorLean);
  const cached = readCachedPhrase(key);
  if (cached && acceptPhrase(cached)) {
    return { phrase: cached, source: "cache" };
  }
  return { phrase: fallbackPhrase(chord, opts), source: "template" };
}
