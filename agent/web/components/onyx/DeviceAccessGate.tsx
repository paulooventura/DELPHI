"use client";

/**
 * After splash, once per app open until the crystal is tapped.
 * Close the tab/page or uninstall to see this again. One tap → location +
 * orientation + motion, then home. Returning from other doors in the same
 * open skips this screen.
 */

import { useEffect, useRef } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { OnyxCrystal } from "./OnyxCrystal";

export function DeviceAccessGate({
  onAllow,
  busy = false,
}: {
  onAllow: () => void;
  busy?: boolean;
}) {
  const filmRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = filmRef.current;
    if (!v) return;
    const holdLastFrame = () => {
      if (!Number.isFinite(v.duration) || v.duration <= 0) return;
      v.currentTime = Math.max(0, v.duration - 0.04);
      v.pause();
    };
    v.muted = true;
    if (v.readyState >= 1) holdLastFrame();
    v.addEventListener("loadedmetadata", holdLastFrame);
    v.addEventListener("durationchange", holdLastFrame);
    return () => {
      v.removeEventListener("loadedmetadata", holdLastFrame);
      v.removeEventListener("durationchange", holdLastFrame);
    };
  }, []);

  return (
    <div className="onyx-root" role="dialog" aria-label="Allow location and sensors">
      <div className="onyx-device onyx-access-gate">
        <div className="onyx-access-film" aria-hidden>
          <video
            ref={filmRef}
            muted
            playsInline
            preload="auto"
            src="/delphi-intro.mp4"
          />
        </div>
        <div className="onyx-access-dim" aria-hidden />

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
        </button>

        <p className="onyx-access-build">
          build {DELPHI_BUILD}
        </p>
      </div>
    </div>
  );
}
