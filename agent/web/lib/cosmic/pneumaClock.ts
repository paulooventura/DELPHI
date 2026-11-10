/**
 * The temple's one clock (Paulo, Nov 10: link the Heliodrome, the Orrery and the Earth view so
 * choosing a date or pausing time in one is the same moment everywhere).
 *
 * Two states:
 *  - live: the instant is the real now.
 *  - held: the instant is a chosen moment (a date picked, time frozen, a scrub, a birthday).
 *
 * Every chamber reads the instant from here each frame (`clockMs()`), so there is no per-view
 * copy to drift. A view may still run its own playback (the Orrery at 1 month/s) as a show; it
 * writes back only when the person acts (pause, pick a date, scrub, Now), so leaving a view
 * never leaves the temple parked at a random moment.
 *
 * The instant is milliseconds since 1970 like Date, held to Date's own range (about ±271,000
 * years). Deep time (Pangea, ice ages, the galaxy's year) is a separate axis, measured in years
 * before present; it lives next to this clock, not inside a Date.
 */

export type ClockMode = "live" | "held";

export interface ClockState {
  mode: ClockMode;
  /** The held instant (ms since 1970). Meaningless while live. */
  atMs: number;
  /** Who set it last, for the chips' wording ("held in the Orrery"). */
  by: string;
  /** The real time (ms since 1970) when it was last set, so views can ask "how far from today". */
  setAtMs: number;
  /**
   * Deep time, in millions of years before present (null = off). The Earth view draws the
   * continents as they were then (Pangea at ~250). Separate from the calendar instant: a Date
   * cannot reach that far, and the sky's math does not hold there.
   */
  agesMa: number | null;
  /** Bumps on every change, for subscribers. */
  version: number;
}

/** Date's own range: ±8.64e15 ms. */
export const CLOCK_MIN_MS = -8.64e15;
export const CLOCK_MAX_MS = 8.64e15;

let state: ClockState = { mode: "live", atMs: 0, by: "", setAtMs: 0, agesMa: null, version: 0 };
const listeners = new Set<() => void>();

function publish(next: Omit<ClockState, "version" | "setAtMs" | "agesMa">) {
  if (next.mode === state.mode && next.atMs === state.atMs && next.by === state.by) return;
  state = { ...state, ...next, setAtMs: Date.now(), version: state.version + 1 };
  for (const fn of listeners) fn();
}

/** The oldest age the Earth view has continents for (Müller et al. 2019). */
export const AGES_MAX_MA = 250;

/** Go to deep time (millions of years ago), or null to come back to the calendar. */
export function setAges(ma: number | null) {
  const v = ma == null || !Number.isFinite(ma) ? null : Math.min(AGES_MAX_MA, Math.max(0, ma));
  if (v === state.agesMa) return;
  state = { ...state, agesMa: v, version: state.version + 1 };
  for (const fn of listeners) fn();
}

const clampMs = (ms: number) => Math.min(CLOCK_MAX_MS, Math.max(CLOCK_MIN_MS, ms));

/** The instant every chamber should draw, in ms since 1970. */
export function clockMs(): number {
  return state.mode === "live" ? Date.now() : state.atMs;
}

export function clockDate(): Date {
  return new Date(clockMs());
}

export function isClockLive(): boolean {
  return state.mode === "live";
}

export function clockState(): ClockState {
  return state;
}

/** Run with the real now again. */
export function goLive(by = "") {
  publish({ mode: "live", atMs: 0, by });
}

/** Hold the temple at one moment. Non-finite input is ignored. */
export function holdAt(ms: number, by = "") {
  if (!Number.isFinite(ms)) return;
  publish({ mode: "held", atMs: clampMs(ms), by });
}

/** Hold at whatever the instant is right now (the Freeze button). */
export function freezeNow(by = "") {
  holdAt(clockMs(), by);
}

/** Move a held clock by a span; a live clock is held first, at now + span. */
export function shiftBy(deltaMs: number, by = "") {
  holdAt(clockMs() + deltaMs, by);
}

export function subscribeClock(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** For tests: back to live with no history. */
export function resetClockForTests() {
  state = { mode: "live", atMs: 0, by: "", setAtMs: 0, agesMa: null, version: 0 };
  listeners.clear();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A short label for the chips: "Live", or "12 Mar 1610 · 21:04", or "44 BCE" style years for
 * dates before year 1 (astronomical year 0 = 1 BCE).
 */
export function clockLabel(s: ClockState = state, withTime = true): string {
  if (s.mode === "live") return "Live";
  const d = new Date(s.atMs);
  const y = d.getFullYear();
  const year = y <= 0 ? `${1 - y} BCE` : String(y);
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]} ${year}`;
  if (!withTime) return day;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} · ${hh}:${mm}`;
}

/** Value for an <input type="datetime-local"> (years 1-9999 only; others return ""). */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  if (y < 1 || y > 9999) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Parse an <input type="datetime-local"> value in local time; NaN when empty or invalid. */
export function fromLocalInputValue(v: string): number {
  const m = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return NaN;
  const d = new Date(2000, 0, 1, 0, 0, 0, 0);
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(Number(m[4]), Number(m[5]), 0, 0);
  return d.getTime();
}
