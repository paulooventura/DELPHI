/**
 * iOS shell glue (Capacitor). Every call is a no-op or a web fallback in a browser,
 * so components can call these without checking the platform first.
 */

import { Capacitor } from "@capacitor/core";
import { apiUrl } from "../apiBase";
import type { GpRow, OrbitSet } from "../orbitRows";
import {
  ISS_ID_BASE,
  ISS_NORAD,
  MOON_ID_BASE,
  issRecFromRow,
  loadAlertPrefs,
  planIssAlerts,
  planMoonAlerts,
  type PlannedAlert,
} from "./skyAlerts";

export function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let booted = false;

/** Once per page: light status-bar text over the dark sky, and refresh any opted-in alerts. */
export async function bootNativeShell(): Promise<void> {
  if (booted || !isNativeShell()) return;
  booted = true;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* older shell without the plugin */
  }
  void refreshSkyAlerts().catch(() => {});
}

export type ShareResult = "shared" | "copied" | "cancelled";

/** Native share sheet in the app; Web Share or clipboard in a browser. */
export async function shareMoment(p: { title: string; text: string; url: string }): Promise<ShareResult> {
  if (isNativeShell()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: p.title, text: p.text, url: p.url, dialogTitle: p.title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: p.title, text: p.text, url: p.url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(`${p.text}\n${p.url}`);
    return "copied";
  } catch {
    return "cancelled";
  }
}

/** Ask iOS for notification permission. Only ever called from the user's own tap. */
export async function askAlertPermission(): Promise<boolean> {
  if (!isNativeShell()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const now = await LocalNotifications.checkPermissions();
    if (now.display === "granted") return true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

async function fetchIssRow(): Promise<GpRow | null> {
  for (const url of [apiUrl(`/api/orbits/active?norad=${ISS_NORAD}`), "/orbits/active.json"]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const set = (await res.json()) as OrbitSet;
      const row = set.rows?.find(r => r[0] === ISS_NORAD);
      if (row) return row;
    } catch {
      /* next source */
    }
  }
  return null;
}

const ours = (id: number) => id >= MOON_ID_BASE && id < ISS_ID_BASE + 100_000;

/** Re-plan the next weeks of alerts from the saved prefs. Clears ours first; leaves nothing behind when off. */
export async function refreshSkyAlerts(now = new Date()): Promise<number> {
  if (!isNativeShell()) return 0;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
  const stale = pending.notifications.filter(n => ours(n.id)).map(n => ({ id: n.id }));
  if (stale.length) await LocalNotifications.cancel({ notifications: stale });

  const prefs = loadAlertPrefs();
  if (!prefs.moon && !prefs.iss) return 0;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return 0;

  const plan: PlannedAlert[] = [];
  if (prefs.moon) plan.push(...planMoonAlerts(now, 60, prefs.place));
  if (prefs.iss && prefs.place) {
    const row = await fetchIssRow();
    const rec = row ? issRecFromRow(row) : null;
    if (rec) plan.push(...planIssAlerts(rec, prefs.place, now));
  }
  if (!plan.length) return 0;
  await LocalNotifications.schedule({
    notifications: plan.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      schedule: { at: a.at, allowWhileIdle: true },
      threadIdentifier: a.id >= ISS_ID_BASE ? "iss" : "moon",
    })),
  });
  return plan.length;
}
