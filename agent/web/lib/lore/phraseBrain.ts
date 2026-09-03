/**
 * Phrase brain — high-capacity voicing of an already-computed chord.
 * ----------------------------------------------------------------------------
 * Math stays local (compose / orchestrate). This module only *voices* a
 * sanitized axis payload. Birth datetime, lat/lon, and tradition names never
 * leave the device. Cursor "High Fast" is an IDE model — it cannot run inside
 * the Delphi app. Live voicing uses Anthropic Sonnet (then OpenAI, then Gemini)
 * when those keys exist on the server.
 */

import type { Composition, DistillOptions } from "./compose";
import { orchestratedPrompt } from "./compose";
import { isTribeColor, type TribeColor } from "./colorLean";
import type { Axis, Polarities, QualiaEntry } from "./qualia";

export type PhraseAxisVote = { system: string; value: number };

export type PhraseBrainPayload = {
  axes: {
    axis: string;
    mean: number;
    coherence: number;
    votes: PhraseAxisVote[];
  }[];
  resonances: { axis: string; strength: number; pole: number }[];
  tensions: { axis: string; strength: number; hi: number; lo: number }[];
  activeQualities: string[];
  fieldSize: number;
  colorLean?: TribeColor;
  castLean?: string[];
};

const TRADITION_LEAK =
  /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|mars|saturn|jupiter|venus|mercury|uranus|neptune|pluto|nakshatra|wuku|muhurta|muhūrta|tzolk|tzolkin|kin\s*\d|horse|tarot|hexagram|i\s*ching|iching|rune|odu|orisha|ogun|fool|anthropic|openai|claude|gpt-|api key)\b/i;

const BANNED_VOICE =
  /\b(energy|energies|vibes?|universe|manifest(?:ing|ation)?|align(?:ed|ment)?|journey|cosmic)\b/i;

const CHALLENGE =
  /\byou\b|\byour\b|choose|pick |prove|challenge|your move|walk through|act like|what will you|decide|plant |stay with|meet it|don't |sit with|name the|your call/i;

function cleanSystem(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

function cleanQuality(raw: string): string | null {
  const q = raw.trim().toLowerCase().replace(/[^a-z\s-]/g, "").slice(0, 28);
  if (q.length < 2) return null;
  if (TRADITION_LEAK.test(q)) return null;
  return q;
}

function finite(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Strip tradition names / PII. Keep system ids for slow-vs-fast depth weights. */
export function toPhraseBrainPayload(
  chord: Composition,
  opts?: DistillOptions,
): PhraseBrainPayload {
  const axes = chord.axes.map(a => ({
    axis: a.axis,
    mean: a.mean,
    coherence: a.coherence,
    votes: a.contributors.map(c => ({
      system: cleanSystem(c.system),
      value: finite(c.value),
    })).filter(v => v.system.length > 0),
  }));

  const resonances = chord.resonances.slice(0, 6).map(r => ({
    axis: r.axis,
    strength: finite(r.strength),
    pole: finite(r.pole),
  }));

  const tensions = chord.tensions.slice(0, 6).map(t => {
    const values = t.poles.map(p => p.value);
    return {
      axis: t.axis,
      strength: finite(t.strength),
      hi: values.length ? Math.max(...values) : 0,
      lo: values.length ? Math.min(...values) : 0,
    };
  });

  const activeQualities = [...new Set(
    chord.activeQualities.map(cleanQuality).filter((q): q is string => Boolean(q)),
  )].slice(0, 48);

  const castLean = (opts?.castLean ?? [])
    .map(cleanQuality)
    .filter((q): q is string => Boolean(q))
    .slice(0, 8);

  return {
    axes,
    resonances,
    tensions,
    activeQualities,
    fieldSize: Math.max(1, Math.min(80, chord.contributors.length)),
    colorLean: opts?.colorLean,
    castLean: castLean.length ? castLean : undefined,
  };
}

function stubEntry(system: string, polarities: Polarities): QualiaEntry {
  return {
    id: "anon",
    system,
    name: "voice",
    glyph: "·",
    qualities: [],
    polarities,
    source: "anon",
    claim: "interpretation",
    nature: "computed",
    observes: "moment",
    honesty: "render",
    tier: "celebrated",
    origin: ["anon"],
    observed: "voice",
  };
}

/** Rebuild a nameless chord so orchestrate() can still depth-weight slow vs fast. */
export function compositionFromPayload(p: PhraseBrainPayload): Composition {
  const entries: QualiaEntry[] = [];
  for (const axis of p.axes) {
    for (const vote of axis.votes) {
      entries.push(stubEntry(vote.system, { [axis.axis as Axis]: vote.value }));
    }
  }
  while (entries.length < p.fieldSize) {
    entries.push(stubEntry("western-zodiac", { active: 0 }));
  }

  return {
    axes: p.axes.map(a => ({
      axis: a.axis,
      mean: a.mean,
      coherence: a.coherence,
      contributors: a.votes.map(v => ({
        name: "voice",
        value: v.value,
        system: v.system,
      })),
    })),
    resonances: p.resonances.map(r => ({
      axis: r.axis,
      strength: r.strength,
      pole: r.pole,
      entries: [],
    })),
    tensions: p.tensions.map(t => ({
      axis: t.axis,
      strength: t.strength,
      poles: [
        { name: "hi", value: t.hi, system: "anon" },
        { name: "lo", value: t.lo, system: "anon" },
      ],
    })),
    activeQualities: p.activeQualities,
    contributors: entries.slice(0, p.fieldSize),
  };
}

export function parsePhraseBrainPayload(raw: unknown): PhraseBrainPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.axes) || o.axes.length === 0 || o.axes.length > 16) return null;

  const axes = o.axes.map((a) => {
    if (!a || typeof a !== "object") return null;
    const row = a as Record<string, unknown>;
    if (typeof row.axis !== "string") return null;
    const votes = Array.isArray(row.votes)
      ? row.votes.slice(0, 40).map((v) => {
          if (!v || typeof v !== "object") return null;
          const vote = v as Record<string, unknown>;
          const system = typeof vote.system === "string" ? cleanSystem(vote.system) : "";
          if (!system) return null;
          return { system, value: Math.max(-1, Math.min(1, finite(vote.value))) };
        }).filter((v): v is PhraseAxisVote => Boolean(v))
      : [];
    return {
      axis: row.axis.slice(0, 24),
      mean: Math.max(-1, Math.min(1, finite(row.mean))),
      coherence: Math.max(0, Math.min(1, finite(row.coherence))),
      votes,
    };
  }).filter((a): a is PhraseBrainPayload["axes"][number] => Boolean(a));

  if (!axes.length) return null;

  const resonances = Array.isArray(o.resonances)
    ? o.resonances.slice(0, 6).map((r) => {
        if (!r || typeof r !== "object") return null;
        const row = r as Record<string, unknown>;
        if (typeof row.axis !== "string") return null;
        return {
          axis: row.axis.slice(0, 24),
          strength: finite(row.strength),
          pole: finite(row.pole),
        };
      }).filter((r): r is PhraseBrainPayload["resonances"][number] => Boolean(r))
    : [];

  const tensions = Array.isArray(o.tensions)
    ? o.tensions.slice(0, 6).map((t) => {
        if (!t || typeof t !== "object") return null;
        const row = t as Record<string, unknown>;
        if (typeof row.axis !== "string") return null;
        return {
          axis: row.axis.slice(0, 24),
          strength: finite(row.strength),
          hi: finite(row.hi),
          lo: finite(row.lo),
        };
      }).filter((t): t is PhraseBrainPayload["tensions"][number] => Boolean(t))
    : [];

  const activeQualities = Array.isArray(o.activeQualities)
    ? [...new Set(o.activeQualities.map(q => typeof q === "string" ? cleanQuality(q) : null)
        .filter((q): q is string => Boolean(q)))]
        .slice(0, 48)
    : [];

  const castLean = Array.isArray(o.castLean)
    ? o.castLean.map(q => typeof q === "string" ? cleanQuality(q) : null)
        .filter((q): q is string => Boolean(q))
        .slice(0, 8)
    : [];

  const colorLean = isTribeColor(o.colorLean) ? o.colorLean : undefined;

  return {
    axes,
    resonances,
    tensions,
    activeQualities,
    fieldSize: Math.max(1, Math.min(80, Math.round(finite(o.fieldSize, axes.length)))),
    colorLean,
    castLean: castLean.length ? castLean : undefined,
  };
}

export function acceptDistilledPhrase(text: string): string | null {
  let phrase = text.replace(/\s+/g, " ").trim();
  phrase = phrase.replace(/^["'`]+|["'`]+$/g, "");
  if (phrase.length < 24 || phrase.length > 320) return null;
  if (!/[.!?]$/.test(phrase)) phrase = `${phrase}.`;
  if (TRADITION_LEAK.test(phrase)) return null;
  if (BANNED_VOICE.test(phrase)) return null;
  if (!CHALLENGE.test(phrase)) {
    phrase = phrase.replace(/[.!?]$/, "") + ". Your call.";
  }
  if (TRADITION_LEAK.test(phrase) || BANNED_VOICE.test(phrase)) return null;
  return phrase;
}

function extractText(raw: unknown, paths: string[][]): string {
  for (const path of paths) {
    let cur: unknown = raw;
    for (const key of path) {
      if (cur == null) break;
      if (/^\d+$/.test(key) && Array.isArray(cur)) cur = cur[Number(key)];
      else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[key];
      else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim()) return cur;
  }
  return "";
}

async function callAnthropic(system: string, user: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model =
    process.env.ANTHROPIC_PHRASE_MODEL
    ?? process.env.ANTHROPIC_DECOMPOSE_MODEL
    ?? "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(14000),
    body: JSON.stringify({
      model,
      max_tokens: 180,
      temperature: 0.55,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return extractText(json, [["content", "0", "text"]]) || null;
}

async function callOpenAI(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_PHRASE_MODEL ?? "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(14000),
    body: JSON.stringify({
      model,
      temperature: 0.55,
      max_tokens: 180,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return extractText(json, [["choices", "0", "message", "content"]]) || null;
}

async function callGemini(system: string, user: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_PHRASE_MODEL ?? "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(14000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { temperature: 0.55, maxOutputTokens: 180 },
      }),
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return extractText(json, [["candidates", "0", "content", "parts", "0", "text"]]) || null;
}

export type PhraseBrainSource = "anthropic" | "openai" | "gemini";

export async function voicePhraseBrain(
  payload: PhraseBrainPayload,
): Promise<{ phrase: string; source: PhraseBrainSource } | null> {
  const chord = compositionFromPayload(payload);
  const opts: DistillOptions = {
    colorLean: payload.colorLean,
    castLean: payload.castLean,
  };
  const { system, user } = orchestratedPrompt(chord, opts);

  const attempts: Array<{ source: PhraseBrainSource; run: () => Promise<string | null> }> = [
    { source: "anthropic", run: () => callAnthropic(system, user) },
    { source: "openai", run: () => callOpenAI(system, user) },
    { source: "gemini", run: () => callGemini(system, user) },
  ];

  for (const attempt of attempts) {
    try {
      const raw = await attempt.run();
      if (!raw) continue;
      const phrase = acceptDistilledPhrase(raw);
      if (phrase) return { phrase, source: attempt.source };
    } catch {
      /* next provider */
    }
  }
  return null;
}

export function brainKeysConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.GEMINI_API_KEY,
  );
}
