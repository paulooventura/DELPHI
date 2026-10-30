/**
 * The opening splash plays on every real app open: a fresh visit, a reload, a cold start
 * of the installed / native app, a reopened tab. It is skipped only for an internal return
 * (a link or Back from Studies / Tonal / the portal into the app) and for Chorus embeds.
 * LAUNCH_KEY still records that the splash ran in this tab, so Back into the app does not replay it.
 */

export const LAUNCH_KEY = "delphi-launched-v3";

/** Static door pages that link (or go Back) into the app. */
const DOOR_PATHS = ["/portal", "/portal.html", "/studies", "/tonal"];

export type LaunchLoad = {
  embed: boolean;
  /** PerformanceNavigationTiming.type: navigate | reload | back_forward | prerender, or null. */
  navType: string | null;
  referrer: string;
  origin: string;
  launchedThisSession: boolean;
};

export function cameFromDoor(referrer: string, origin: string): boolean {
  if (!referrer) return false;
  try {
    const u = new URL(referrer);
    if (u.origin !== origin) return false;
    return DOOR_PATHS.some(p => u.pathname === p || u.pathname.startsWith(`${p}/`));
  } catch {
    return false;
  }
}

export function shouldPlaySplash(l: LaunchLoad): boolean {
  if (l.embed) return false;
  // A reload keeps the old referrer, so it must win over the door check.
  if (l.navType === "reload") return true;
  if (cameFromDoor(l.referrer, l.origin)) return false;
  if (l.navType === "back_forward" && l.launchedThisSession) return false;
  return true;
}

export function readLaunchLoad(): LaunchLoad {
  let navType: string | null = null;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    navType = nav?.type ?? null;
  } catch {
    navType = null;
  }
  let embed = false;
  try {
    embed = new URLSearchParams(window.location.search).get("embed") === "1";
  } catch {
    embed = false;
  }
  return {
    embed,
    navType,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    origin: window.location.origin,
    launchedThisSession: hasLaunchedThisSession(),
  };
}

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
