/**
 * Reader's mouth for the home phrase — local only.
 * Never retunes composeMoment. Voice + depth + brain are how it SPEAKS.
 */

import type { DistillVoice } from "./compose";
import type { PhraseBrainSource } from "./phraseBrain";

export type DistillDepth = "spark" | "deep";
export type DistillBrain = "auto" | PhraseBrainSource;

export type DistillPrefs = {
  voice: DistillVoice;
  depth: DistillDepth;
  brain: DistillBrain;
};

export type BrainAvailability = {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
};

const KEY = "delphi-distill-v1";

export const DEFAULT_DISTILL: DistillPrefs = {
  voice: "field",
  depth: "deep",
  brain: "auto",
};

export const VOICE_ROWS: { id: DistillVoice; label: string; feel: string }[] = [
  { id: "field", label: "Let the field", feel: "Whatever this chord is signaling" },
  { id: "warm-witness", label: "Warm", feel: "Intimate. Name it. Don't improve it." },
  { id: "plain-reading", label: "Clear", feel: "Even, clean, a straight read" },
  { id: "quiet-riddle", label: "Veiled", feel: "Leave something unsaid" },
  { id: "trickster-challenge", label: "Dare", feel: "It dealt you a hand. Play it." },
];

export const DEPTH_ROWS: { id: DistillDepth; label: string; feel: string }[] = [
  { id: "spark", label: "Spark", feel: "Now. On this device." },
  { id: "deep", label: "Deep", feel: "Let a mind turn the whole chord." },
];

export const BRAIN_ROWS: { id: DistillBrain; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "anthropic", label: "Claude" },
  { id: "openai", label: "GPT" },
  { id: "gemini", label: "Gemini" },
];

function isVoice(v: unknown): v is DistillVoice {
  return VOICE_ROWS.some(r => r.id === v);
}
function isDepth(v: unknown): v is DistillDepth {
  return v === "spark" || v === "deep";
}
function isBrain(v: unknown): v is DistillBrain {
  return v === "auto" || v === "anthropic" || v === "openai" || v === "gemini";
}

export function loadDistillPrefs(): DistillPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_DISTILL };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DISTILL };
    const parsed = JSON.parse(raw) as Partial<DistillPrefs>;
    return {
      voice: isVoice(parsed.voice) ? parsed.voice : DEFAULT_DISTILL.voice,
      depth: isDepth(parsed.depth) ? parsed.depth : DEFAULT_DISTILL.depth,
      brain: isBrain(parsed.brain) ? parsed.brain : DEFAULT_DISTILL.brain,
    };
  } catch {
    return { ...DEFAULT_DISTILL };
  }
}

export function saveDistillPrefs(next: DistillPrefs): DistillPrefs {
  const prefs: DistillPrefs = {
    voice: isVoice(next.voice) ? next.voice : DEFAULT_DISTILL.voice,
    depth: isDepth(next.depth) ? next.depth : DEFAULT_DISTILL.depth,
    brain: isBrain(next.brain) ? next.brain : DEFAULT_DISTILL.brain,
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* quota */
    }
  }
  return prefs;
}

export function voiceChipLabel(voice: DistillVoice): string {
  return VOICE_ROWS.find(r => r.id === voice)?.label ?? "Let the field";
}

export function anyBrain(avail: BrainAvailability | null): boolean {
  if (!avail) return false;
  return avail.anthropic || avail.openai || avail.gemini;
}

export function listedBrains(avail: BrainAvailability | null): PhraseBrainSource[] {
  if (!avail) return [];
  const out: PhraseBrainSource[] = [];
  if (avail.anthropic) out.push("anthropic");
  if (avail.openai) out.push("openai");
  if (avail.gemini) out.push("gemini");
  return out;
}
