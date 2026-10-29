/**
 * One-time permission before anything a person types goes to third-party AI (App Review 5.1.2(i)).
 * Stored on the device only; "Not now" stores nothing, so the question is asked again next time.
 */
export const AI_CONSENT_KEY = "pm-ai-consent-v1";

/** Who a Research question can reach (lib/researchEngine.ts). Keep in step with /privacy. */
export const RESEARCH_AI_PROVIDERS = [
  "Anthropic",
  "OpenAI",
  "Google (Gemini)",
  "Perplexity",
  "Exa",
  "Serper (Google Search)",
  "Valyu",
] as const;

export function hasAiConsent(): boolean {
  try {
    return localStorage.getItem(AI_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function giveAiConsent() {
  try {
    localStorage.setItem(AI_CONSENT_KEY, "1");
  } catch {
    /* private mode: ask again next time */
  }
}