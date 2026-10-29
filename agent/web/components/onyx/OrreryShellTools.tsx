"use client";

import { useState, useSyncExternalStore } from "react";
import { askAlertPermission, isNativeShell, refreshSkyAlerts, shareMoment } from "../../lib/native/shell";
import { loadAlertPrefs, roundPlace, saveAlertPrefs, type AlertPrefs } from "../../lib/native/skyAlerts";

const LIVE_SKY = "https://delphi.pauloventura.org/?mode=sky";
const noSubscribe = () => () => {};

/** Share + (in the iOS app) opt-in sky alerts, for the orrery's tool row. */
export function OrreryShellTools({ focus }: { focus: string | null }) {
  const native = useSyncExternalStore(noSubscribe, isNativeShell, () => false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const share = async () => {
    const when = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const text = focus ? `${focus} in the orrery, ${when}. Pneuma Mundi` : `The solar system right now, ${when}. Pneuma Mundi`;
    const r = await shareMoment({ title: "Pneuma Mundi", text, url: LIVE_SKY });
    setNote(r === "copied" ? "Link copied" : "");
  };

  return (
    <>
      <button type="button" className="onyx-orr-chip" onClick={() => void share()}>
        Share
      </button>
      {native ? (
        <button type="button" className={`onyx-orr-chip${open ? " on" : ""}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
          Alerts
        </button>
      ) : null}
      {note ? (
        <span className="onyx-orr-date" aria-live="polite">
          {note}
        </span>
      ) : null}
      {open ? <SkyAlertsCard onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SkyAlertsCard({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<AlertPrefs>(() => loadAlertPrefs());
  const [msg, setMsg] = useState("");

  const apply = async (next: AlertPrefs) => {
    if ((next.moon || next.iss) && !(await askAlertPermission())) {
      setMsg("Notifications are off for Pneuma Mundi. Turn them on in iOS Settings › Notifications.");
      return;
    }
    saveAlertPrefs(next);
    setPrefs(next);
    const n = await refreshSkyAlerts().catch(() => 0);
    setMsg(next.moon || next.iss ? (n ? `${n} alerts planned on this phone.` : "Nothing visible in the next days yet.") : "Alerts off.");
  };

  const savePlace = () => {
    if (!navigator.geolocation) return setMsg("Location isn't available here.");
    setMsg("Finding your place…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const place = roundPlace(pos.coords.latitude, pos.coords.longitude, "Saved place");
        void apply({ ...prefs, place, iss: true });
      },
      () => setMsg("Couldn't get your location. You can still get moon alerts."),
      { maximumAge: 10 * 60_000, timeout: 15_000 },
    );
  };

  return (
    <section className="onyx-orr-card onyx-orr-alerts" aria-label="Sky alerts">
      <header>
        <div>
          <h2>Sky alerts</h2>
          <p>Planned on this phone. Your place stays here, rounded to about 1 km.</p>
        </div>
        <button type="button" className="onyx-orr-card-x" onClick={onClose} aria-label="Close sky alerts">
          ×
        </button>
      </header>
      <div className="onyx-orr-row">
        <button
          type="button"
          className={`onyx-orr-chip${prefs.moon ? " on" : ""}`}
          aria-pressed={prefs.moon}
          onClick={() => void apply({ ...prefs, moon: !prefs.moon })}
        >
          Full &amp; new moon
        </button>
        {prefs.place ? (
          <button
            type="button"
            className={`onyx-orr-chip${prefs.iss ? " on" : ""}`}
            aria-pressed={prefs.iss}
            onClick={() => void apply({ ...prefs, iss: !prefs.iss })}
          >
            ISS passes
          </button>
        ) : (
          <button type="button" className="onyx-orr-chip" onClick={savePlace}>
            ISS passes: save my place
          </button>
        )}
        {prefs.place ? (
          <button type="button" className="onyx-orr-chip ghost" onClick={() => void apply({ ...prefs, iss: false, place: null })}>
            Forget place
          </button>
        ) : null}
      </div>
      {msg ? (
        <p className="onyx-orr-date" aria-live="polite">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
