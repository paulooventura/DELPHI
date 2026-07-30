/**
 * Distilled moment phrase — model path with loud, never-silent fallback.
 * Home paints the template immediately; upgrades when the model returns.
 */

import type { Composition, DistillOptions } from "./compose";
import { distillTemplate, orchestratedPrompt } from "./compose";
import type { TribeColor } from "./colorLean";

// Horoscope filler + calendar/tradition name-drops must never reach the street line.
const BANNED =
  /\b(energy|vibes|manifest|align|journey|universe|cosmic)\b|\b(leo|aries|taurus|gemini|cancer|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b|\b(rat|ox|tiger|rabbit|dragon|snake|horse|goat|sheep|monkey|rooster|dog|pig|boar)\b|\b(kin|tzolk'?in|tzolkin|hijri|hebrew|ethiopian|persian|dreamspell)\b|\brhythmic\s+seed\b|\b(red|white|blue|yellow)\s+(dragon|wind|night|seed|serpent|worldbridger|hand|star|moon|dog|monkey|human|skywalker|wizard|eagle|warrior|earth|mirror|storm|sun)\b/i;

export function phraseCacheKey(
  civilYmd: string,
  lat: number,
  lon: number,
  colorLean?: TribeColor | null,
  castLeanKey = "none",
  /** Active reading layer + fingerprints (Addendum 2). */
  layerKey = "moment",
): string {
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  // v7: orchestrated prompt (Addendum 4) — cache per layer + personal fingerprints.
  const lean = colorLean ?? "none";
  return `delphi-phrase:v7:${civilYmd}:${rLat}:${rLon}:${layerKey}:${lean}:${castLeanKey}`;
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

export type DistillAttempt = {
  /** Model sentence when the call succeeded and passed gates. */
  phrase: string | null;
  /** True only when the Anthropic path returned an accepted sentence. */
  ok: boolean;
  /** Human-readable reason when falling back — always set on failure. */
  reason: string;
  httpStatus?: number;
  responseBody?: string;
};

function logFallback(attempt: DistillAttempt): void {
  // Loud by design — never silent. Production console + optional on-screen.
  console.error(
    `DISTILL FALLBACK: ${attempt.reason}`,
    {
      httpStatus: attempt.httpStatus,
      responseBody: attempt.responseBody,
    },
  );
}

/**
 * Call /api/lore/distill with orchestratedPrompt(chord).
 * Never swallows errors — every failure returns a typed reason and logs loud.
 */
export async function fetchModelPhrase(
  chord: Composition,
  opts?: DistillOptions,
): Promise<DistillAttempt> {
  // Primary path: orchestratedPrompt(snapshot.chord) — root/tension/register.
  let system: string;
  let user: string;
  try {
    ({ system, user } = orchestratedPrompt(chord, opts));
  } catch (err) {
    const attempt: DistillAttempt = {
      phrase: null,
      ok: false,
      reason: `orchestratedPrompt threw: ${err instanceof Error ? err.message : String(err)}`,
    };
    logFallback(attempt);
    return attempt;
  }

  try {
    const res = await fetch("/api/lore/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chord, opts, system, user }),
    });
    const rawText = await res.text();
    let data: {
      phrase?: string;
      error?: string;
      reason?: string;
      body?: string;
      raw?: string;
    } = {};
    try {
      data = JSON.parse(rawText) as typeof data;
    } catch {
      data = {};
    }

    if (!res.ok) {
      const attempt: DistillAttempt = {
        phrase: null,
        ok: false,
        reason:
          data.reason ||
          data.error ||
          `HTTP ${res.status} from /api/lore/distill`,
        httpStatus: res.status,
        responseBody: (data.body || data.raw || rawText).slice(0, 800),
      };
      logFallback(attempt);
      return attempt;
    }

    const accepted = acceptPhrase(data.phrase ?? "");
    if (!accepted) {
      const attempt: DistillAttempt = {
        phrase: null,
        ok: false,
        reason: `model returned but acceptPhrase rejected: ${JSON.stringify(data.phrase ?? "").slice(0, 200)}`,
        httpStatus: res.status,
        responseBody: rawText.slice(0, 800),
      };
      logFallback(attempt);
      return attempt;
    }

    console.info("DISTILL OK: model phrase accepted", accepted.slice(0, 80));
    return { phrase: accepted, ok: true, reason: "ok" };
  } catch (err) {
    const attempt: DistillAttempt = {
      phrase: null,
      ok: false,
      reason: `fetch threw: ${err instanceof Error ? err.message : String(err)}`,
    };
    logFallback(attempt);
    return attempt;
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
  layerKey = "moment",
): PhraseResult {
  const castKey = (opts?.castLean ?? []).slice(0, 6).join("+") || "none";
  const key = phraseCacheKey(civilYmd, lat, lon, opts?.colorLean, castKey, layerKey);
  const cached = readCachedPhrase(key);
  if (cached && acceptPhrase(cached)) {
    return { phrase: cached, source: "cache" };
  }
  return { phrase: fallbackPhrase(chord, opts), source: "template" };
}
