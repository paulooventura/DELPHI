/** Fired by on-device stores after a real change so the encrypted backup can follow. */
export const LOCAL_CHANGE_EVENT = "pm-local-change";

/**
 * Sets (or removes, for null) a localStorage item and announces it only when
 * the stored value actually changed — re-saving the same value on mount must
 * not look like a fresh edit to the sync.
 */
export function writeLocal(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  const prev = window.localStorage.getItem(key);
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
  if (prev !== value) window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: key }));
}
