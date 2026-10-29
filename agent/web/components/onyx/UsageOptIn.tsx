"use client";

import { useSyncExternalStore } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { isNativeShell } from "../../lib/native/shell";
import { onUsageOptInChange, setUsageOptIn, usageOptedIn } from "../../lib/telemetry/client";

const noSubscribe = () => () => {};

/** iOS app only: the anonymous usage counter is off until the person chooses to share. */
export function UsageOptIn() {
  const native = useSyncExternalStore(noSubscribe, isNativeShell, () => false);
  const on = useSyncExternalStore(onUsageOptInChange, usageOptedIn, () => false);
  if (!native) return null;

  return (
    <>
      <p className="onyx-eyebrow">ANONYMOUS USAGE</p>
      <p className="onyx-layer-meta">
        Help tune the app by sharing which screens you spend time on and which buttons you tap. Never what
        you type, never birth data, no location, and no lasting id: each session is counted on its own. Every
        feature works the same either way, and you can change this any time.
      </p>
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
    </>
  );
}
