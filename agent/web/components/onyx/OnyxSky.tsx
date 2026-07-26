"use client";

import type { RefObject } from "react";
import {
  CelestialSkyView,
  type LiveAttitude,
} from "../CelestialSkyView";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { cardinalFromHeading } from "./onyxCopy";

export function OnyxSky({
  now,
  lat,
  lon,
  altM,
  headingDeg,
  pitchDeg,
  liveAttitudeRef,
  liveHeading = false,
  livePitch = false,
  arPoseReady = true,
  hapticsEnabled = true,
  warmth = 0.55,
  weather = null,
  onBack,
}: {
  now: Date;
  lat: number;
  lon: number;
  altM: number;
  headingDeg: number;
  pitchDeg: number;
  liveAttitudeRef?: RefObject<LiveAttitude>;
  liveHeading?: boolean;
  livePitch?: boolean;
  arPoseReady?: boolean;
  hapticsEnabled?: boolean;
  warmth?: number;
  weather?: SkyWeatherSlot | null;
  onBack: () => void;
}) {
  const live = liveHeading || livePitch;
  const look = cardinalFromHeading(headingDeg);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const pitchLabel = Number.isFinite(pitchDeg) ? Math.round(pitchDeg) : 0;

  return (
    <div className="onyx-root">
      <div className="onyx-device onyx-sky-device" role="application" aria-label="Delphi sky view">
        <button type="button" className="onyx-sky-back" onClick={onBack}>
          ← home
        </button>

        <div className="onyx-sky-live">
          <CelestialSkyView
            lat={lat}
            lon={lon}
            observerAltM={altM}
            headingDeg={headingDeg}
            pitchDeg={pitchDeg}
            liveAttitudeRef={live ? liveAttitudeRef : undefined}
            observationTime={now}
            liveHeading={liveHeading}
            livePitch={livePitch}
            arPoseReady={arPoseReady}
            hapticsEnabled={hapticsEnabled}
            warmth={warmth}
            weather={weather}
          />
        </div>

        <div className="onyx-sky-top">
          <span className="onyx-wordmark">DELPHI</span>
        </div>
        <div className="onyx-sky-coords">
          <span>
            {Math.abs(lat).toFixed(2)}°{lat >= 0 ? "N" : "S"} · looking {look} · {pitchLabel}°
          </span>
          <span>{time}</span>
        </div>

        <p className="onyx-sky-hint">
          {live
            ? arPoseReady
              ? "Live AR — aim the phone to see what’s around you"
              : "Hold the phone more upright to lock AR pose"
            : "Allow motion & location — then aim the phone at the sky"}
        </p>
      </div>
    </div>
  );
}
