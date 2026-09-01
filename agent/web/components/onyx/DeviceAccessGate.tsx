"use client";

/**
 * After splash, once per page session until the crystal is tapped.
 * Close the tab/page or uninstall to see this again. One tap → location +
 * orientation + motion, then home.
 */

import { DELPHI_BUILD } from "../../lib/buildStamp";
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
            stay live. This screen shows once after you open Delphi, until you
            close the page or uninstall. Tap the crystal once to continue.
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

        <p className="onyx-access-build">
          build {DELPHI_BUILD}
          {" · "}
          <a href={`/portal?b=${DELPHI_BUILD}`} className="onyx-access-portal-link">
            Portal (Tonal &amp; Studies)
          </a>
        </p>
      </div>
    </div>
  );
}
