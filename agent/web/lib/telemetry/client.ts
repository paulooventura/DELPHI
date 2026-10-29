/** Calls into /pm-telemetry.js; queues until it loads (it is afterInteractive). */

type PmTrack = {
  enabled: boolean;
  live?: boolean;
  app?: boolean;
  screen: (name: string) => void;
  event: (name: string, detail?: string) => void;
};
type PmWindow = Window & { pmTrack?: PmTrack; __pmq?: unknown[][] };

/** iOS app only: usage counting is off until this is "1". Read by pm-telemetry.js. */
export const USAGE_OPTIN_KEY = "pm-track-optin";
const OPTIN_EVENT = "pm-optin-change";

export function usageOptedIn(): boolean {
  try {
    return localStorage.getItem(USAGE_OPTIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function onUsageOptInChange(cb: () => void): () => void {
  window.addEventListener(OPTIN_EVENT, cb);
  return () => window.removeEventListener(OPTIN_EVENT, cb);
}

/** Takes effect at once: opting in starts the counter, opting out drops anything not yet sent. */
export function setUsageOptIn(on: boolean, build: string) {
  try {
    if (on) localStorage.setItem(USAGE_OPTIN_KEY, "1");
    else localStorage.removeItem(USAGE_OPTIN_KEY);
  } catch {
    return;
  }
  const w = window as PmWindow;
  if (on && w.pmTrack && !w.pmTrack.live) {
    delete w.pmTrack;
    const s = document.createElement("script");
    s.src = `/pm-telemetry.js?v=${build}&optin=1`;
    document.body.appendChild(s);
  } else if (w.pmTrack?.live) {
    w.pmTrack.enabled = on;
  }
  window.dispatchEvent(new Event(OPTIN_EVENT));
}

function send(cmd: unknown[]) {
  if (typeof window === "undefined") return;
  const w = window as PmWindow;
  if (w.pmTrack) {
    if (cmd[0] === "screen") w.pmTrack.screen(cmd[1] as string);
    else w.pmTrack.event(cmd[1] as string, cmd[2] as string | undefined);
    return;
  }
  (w.__pmq ??= []).push(cmd);
}

export function trackScreen(name: string) {
  send(["screen", name]);
}

/** Never pass typed text, birth data, or Psyche readings as detail. */
export function trackEvent(name: string, detail?: string) {
  send(["event", name, detail]);
}
