/**
 * The opening: Historical → Pythia → Stairs → the cake offering (void), on every app open.
 * The cake closes it every time. Its last frame holds under the access gate when Allow is
 * still needed, otherwise under one quiet Enter into the home.
 * With the pilgrim guide on, each film holds on its last frame for that step's box.
 */

export const OPENING_CLIPS = ["historical", "pythia", "stairs", "void"] as const;
export type OpeningClipId = (typeof OPENING_CLIPS)[number];

export type OpeningEnd = "gate" | "enter";

export type OpeningStep =
  | { kind: "clip"; idx: number }
  | { kind: "guide"; idx: number }
  | { kind: "end"; end: OpeningEnd };

export type OpeningPlan = { guide: boolean; needsGate: boolean };

export const LAST_CLIP = OPENING_CLIPS.length - 1;

export function openingEnd(needsGate: boolean): OpeningEnd {
  return needsGate ? "gate" : "enter";
}

/** What follows when clip `idx` reaches its last frame. */
export function afterClip(idx: number, plan: OpeningPlan): OpeningStep {
  if (plan.guide) return { kind: "guide", idx };
  if (idx < LAST_CLIP) return { kind: "clip", idx: idx + 1 };
  return { kind: "end", end: openingEnd(plan.needsGate) };
}

/** What follows the guide box's button on clip `idx`. */
export function afterGuide(idx: number, plan: OpeningPlan): OpeningStep {
  if (idx < LAST_CLIP) return { kind: "clip", idx: idx + 1 };
  return { kind: "end", end: openingEnd(plan.needsGate) };
}

/** A deliberate skip (tap after the guard, Esc, or "Skip the guide") lands on the cake's last frame. */
export function skipTo(plan: OpeningPlan): OpeningStep {
  return { kind: "end", end: openingEnd(plan.needsGate) };
}

export const PILGRIM_GUIDE_KEY = "pneuma-pilgrim-guide-v1";
const PILGRIM_REPLAY_KEY = "pneuma-pilgrim-guide-replay";

export function hasSeenPilgrimGuide(): boolean {
  try {
    return localStorage.getItem(PILGRIM_GUIDE_KEY) === "seen";
  } catch {
    return true;
  }
}

/** Seen or skipped: later opens play without pauses, and a pending About replay is used up. */
export function markPilgrimGuideSeen(): void {
  try {
    localStorage.setItem(PILGRIM_GUIDE_KEY, "seen");
  } catch {
    /* private mode */
  }
  try {
    sessionStorage.removeItem(PILGRIM_REPLAY_KEY);
  } catch {
    /* private mode */
  }
}

/** About → "Walk the pilgrim's way again": the next opening in this tab shows the guide. */
export function requestPilgrimGuideReplay(): void {
  try {
    sessionStorage.setItem(PILGRIM_REPLAY_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function pilgrimGuideWanted(): boolean {
  let replay = false;
  try {
    replay = sessionStorage.getItem(PILGRIM_REPLAY_KEY) === "1";
  } catch {
    replay = false;
  }
  return replay || !hasSeenPilgrimGuide();
}
