/** Calls into /pm-telemetry.js; queues until it loads (it is afterInteractive). */

type PmTrack = { enabled: boolean; screen: (name: string) => void; event: (name: string, detail?: string) => void };
type PmWindow = Window & { pmTrack?: PmTrack; __pmq?: unknown[][] };

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
