"use client";

/**
 * First screen on every load until the crystal is tapped.
 * One tap → location + orientation + motion prompts, then splash/home.
 */

import { OnyxCrystal } from "./OnyxCrystal";

export function DeviceAccessGate({
  onAllow,
  busy = false,
}: {
  onAllow: () => void;
  busy?: boolean;
}) {
  return (
    <div className="onyx-root" role="dialog" aria-label="Allow location and sensors">
      <div className="onyx-device onyx-access-gate">
        <div className="onyx-access-copy">
          <p className="onyx-access-phrase">
            Delphi reads the sky from where you are.
          </p>
          <p className="onyx-access-lead">
            Allow location and device sensors so the compass, sky map, and moment
            stay live. This screen opens every time you load Delphi — tap the
            crystal once to continue.
          </p>
        </div>

        <button
          type="button"
          className={`onyx-access-cta${busy ? " busy" : ""}`}
          disabled={busy}
          onClick={onAllow}
          autoFocus
        >
          <span className="onyx-access-cta-gem" aria-hidden>
            <OnyxCrystal />
          </span>
          <span className="onyx-access-cta-label">
            {busy ? "Requesting…" : "Allow access"}
          </span>
          <span className="onyx-access-cta-sub">
            Location · orientation · motion
          </span>
        </button>
      </div>
    </div>
  );
}
