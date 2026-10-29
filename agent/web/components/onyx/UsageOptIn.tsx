"use client";

import { useSyncExternalStore } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { isNativeShell } from "../../lib/native/shell";
import {
  onUsageOptInChange,
  setUsageOptIn,
  usageBlockedByBrowser,
  usageOptedIn,
} from "../../lib/telemetry/client";

const noSubscribe = () => () => {};

/** Anonymous usage counts: off until chosen in the iOS app, on until declined on the web. */
export function UsageOptIn() {
  const native = useSyncExternalStore(noSubscribe, isNativeShell, () => false);
  const gpc = useSyncExternalStore(noSubscribe, usageBlockedByBrowser, () => false);
  const on = useSyncExternalStore(onUsageOptInChange, usageOptedIn, () => false);

  return (
    <>
      <p className="onyx-eyebrow">ANONYMOUS USAGE</p>
      {native ? (
        <p className="onyx-layer-meta">
          Help tune the app by sharing which screens you spend time on and which buttons you tap. Never what
          you type, never birth data, no location, and no lasting id: each session is counted on its own. Every
          feature works the same either way, and you can change this any time.
        </p>
      ) : (
        <p className="onyx-layer-meta">
          Anonymous usage counts help tune Pneuma: which screens you spend time on and which buttons you tap,
          with a random visitor id and the approximate city your connection suggests. Never what you type, never
          birth data. Every feature works the same either way, and you can change this any time.
        </p>
      )}
      {gpc ? (
        <p className="onyx-layer-meta">Your browser&apos;s Global Privacy Control is on, so nothing is counted.</p>
      ) : (
        <div className="onyx-orr-row" role="group" aria-label="Share anonymous usage">
          <button
            type="button"
            className={`onyx-orr-chip${on ? " on" : ""}`}
            aria-pressed={on}
            onClick={() => setUsageOptIn(true, DELPHI_BUILD)}
          >
            Share
          </button>
          <button
            type="button"
            className={`onyx-orr-chip${on ? "" : " on"}`}
            aria-pressed={!on}
            onClick={() => setUsageOptIn(false, DELPHI_BUILD)}
          >
            Don&apos;t share
          </button>
        </div>
      )}
    </>
  );
}
