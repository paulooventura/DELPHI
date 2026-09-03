/**
 * Splash plays once per app open. sessionStorage dies when the tab/WebView
 * closes; returning from Studies / Tonal / other doors must not replay it.
 */

export const LAUNCH_KEY = "delphi-launched-v3";

export function hasLaunchedThisSession(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(LAUNCH_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLaunchedThisSession(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(LAUNCH_KEY, "1");
  } catch {
    /* private mode */
  }
}
