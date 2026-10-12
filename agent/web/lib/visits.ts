/** Per-device session count. A "session" is one browser tab life (sessionStorage). */
const COUNT_KEY = "pm-visits";
const COUNTED_KEY = "pm-visit-counted";

/** First sessions get visible compass labels, the gem shimmer and "Know Thyself" under the inscription. */
export const FRESH_VISITS = 3;

export function sessionVisitCount(): number {
  try {
    let n = Number(localStorage.getItem(COUNT_KEY) || "0") || 0;
    if (sessionStorage.getItem(COUNTED_KEY) !== "1") {
      n += 1;
      localStorage.setItem(COUNT_KEY, String(n));
      sessionStorage.setItem(COUNTED_KEY, "1");
    }
    return n;
  } catch {
    return FRESH_VISITS + 1;
  }
}

export function isFreshVisit(): boolean {
  return sessionVisitCount() <= FRESH_VISITS;
}
