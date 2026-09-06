"use client";

/**
 * After splash, once per app open until the gem is tapped.
 * Close the tab/page or uninstall to see this again. One tap → location +
 * orientation + motion, then home. Returning from other doors in the same
 * open skips this screen.
 */

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
          autoFocus
        >
          <img
            className="onyx-access-gem"
            src="/allow-access-gem.jpg"
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
