"use client";

/**
 * After splash, once per app open until Allow access is tapped.
 * Close the tab/page or uninstall to see this again. One tap → location +
 * orientation + motion, then home. Returning from other doors in the same
 * open skips this screen.
 *
 * Backdrop: Paulo’s near-black sacred-void still (build-stamped for CDN bust).
 */

import { DELPHI_BUILD } from "../../lib/buildStamp";

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
        <button
          type="button"
          className={`onyx-access-cta${busy ? " busy" : ""}`}
          disabled={busy}
          onClick={onAllow}
        >
          <img
            className="onyx-access-backdrop"
            src={`/allow-access-backdrop.jpg?v=${DELPHI_BUILD}`}
            alt=""
            draggable={false}
          />
          <span className="onyx-access-cta-label">
            {busy ? "Requesting…" : "Allow access"}
          </span>
        </button>
      </div>
    </div>
  );
}
