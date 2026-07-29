"use client";

/**
 * First screen on every load until Allow is tapped.
 * One tap → location + orientation + motion prompts, then splash/home.
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
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <div className="onyx-overlay" style={{ justifyContent: "center", gap: 20 }}>
          <p className="onyx-eyebrow">HERE</p>
          <p className="onyx-layer-phrase" style={{ textAlign: "left" }}>
            Delphi reads the sky from where you are.
          </p>
          <p className="onyx-layer-lead" style={{ margin: 0 }}>
            Allow location and device sensors so the compass, sky map, and moment
            stay live. This screen opens every time you load Delphi — tap once to
            continue.
          </p>
          <button
            type="button"
            className="onyx-tool-btn"
            disabled={busy}
            onClick={onAllow}
            autoFocus
          >
            {busy ? "Requesting…" : "Allow access"}
            <span>Location · orientation · motion</span>
          </button>
        </div>
      </div>
    </div>
  );
}
