"use client";

/**
 * Shown only when splash was skipped and we have not yet asked for
 * location / orientation / motion. One tap primes access for the session.
 */
export function DeviceAccessGate({ onAllow }: { onAllow: () => void }) {
  return (
    <div className="onyx-root" role="dialog" aria-label="Allow location and sensors">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <div className="onyx-overlay" style={{ justifyContent: "center", gap: 20 }}>
          <p className="onyx-eyebrow">HERE</p>
          <p className="onyx-layer-phrase" style={{ textAlign: "left" }}>
            Delphi reads the sky from where you are.
          </p>
          <p className="onyx-layer-lead" style={{ margin: 0 }}>
            Allow location and device sensors once — then the compass, sky map, and
            moment stay live without asking again.
          </p>
          <button type="button" className="onyx-tool-btn" onClick={onAllow}>
            Allow access
            <span>Location · orientation · motion</span>
          </button>
        </div>
      </div>
    </div>
  );
}
