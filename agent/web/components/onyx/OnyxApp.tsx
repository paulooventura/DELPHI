"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CosmicClockState } from "../../lib/cosmic";
import type { CycleSnapshot } from "../../lib/cycleSystems";
import type { CycleReading, WorldCyclePreferences } from "../../lib/worldCycles";
import { computeCelestialBodies } from "../../lib/cosmic/celestialBodies";
import { DashboardContainer } from "../DashboardContainer";
import type { RingSelectHandler } from "../CosmicClockWheel";
import { AtlasPanel } from "../AtlasPanel";
import { SensorArray, type SensorArrayProps } from "../SensorArray";
import { EmfReader } from "../EmfReader";
import { PauloVenturaHub } from "../PauloVenturaHub";
import { OnyxHome } from "./OnyxHome";
import { OnyxSky } from "./OnyxSky";
import { OnyxSplash } from "./OnyxSplash";
import "./onyx.css";

export type OnyxMode = "home" | "sky" | "rings" | "tools" | "atlas" | "senses" | "oracle";

export function OnyxApp({
  showSplash,
  onSplashDone,
  now,
  lat,
  lon,
  altM,
  headingDeg,
  pitchDeg,
  cycles,
  cosmic,
  stripReadings,
  multiVoice,
  cyclePrefs,
  onCyclePrefsChange,
  onRingSelect,
  onTellMore,
  emfUt,
  emfLive,
  emfMethod,
  sensorProps,
  oracleExtra,
}: {
  showSplash: boolean;
  onSplashDone: () => void;
  now: Date;
  lat: number;
  lon: number;
  altM: number | null;
  headingDeg: number;
  pitchDeg: number;
  cycles: CycleSnapshot | null;
  cosmic: CosmicClockState | null;
  stripReadings: CycleReading[];
  multiVoice?: string;
  cyclePrefs: WorldCyclePreferences;
  onCyclePrefsChange: (next: WorldCyclePreferences) => void;
  onRingSelect?: RingSelectHandler;
  onTellMore?: (name: string) => void;
  emfUt?: number | null;
  emfLive?: boolean;
  emfMethod?: string | null;
  sensorProps?: SensorArrayProps;
  oracleExtra?: ReactNode;
}) {
  const [mode, setMode] = useState<OnyxMode>("home");

  const phaseFraction = cosmic?.lunarPhaseFraction ?? cycles?.lunar?.fraction ?? 0.35;

  const moonAlt = useMemo(() => {
    const moon = computeCelestialBodies(now, lat, lon, altM ?? 0).find(b => b.id === "moon");
    return moon?.alt ?? null;
  }, [now, lat, lon, altM]);

  const zodiacSign = cycles?.westernZodiac?.sign ?? "the sky";
  const phaseName = (cycles?.lunar?.phase ?? "Moon").toLowerCase();
  const momentLine =
    multiVoice?.trim() ||
    `${phaseName.charAt(0).toUpperCase()}${phaseName.slice(1)} in ${zodiacSign}. A day for finishing what's begun.`;

  const galactic = cycles?.galactic;
  const selfTone = galactic ? (
    <>
      You are Kin {galactic.kin} —
      <br />
      {galactic.tone.name} {galactic.tribe.name}.
    </>
  ) : (
    <>
      You are near the close
      <br />
      of a long orbit.
    </>
  );
  const selfRet = galactic ? (
    <>
      Tone <b>{galactic.tone.tone}</b> {galactic.tone.name}.
      <br />
      {galactic.tribe.color} {galactic.tribe.name} · {galactic.tribe.mayaSign}.
      <br />
      The moon tonight sits where the count places you.
    </>
  ) : (
    <>Hold still. The sky is still reading you.</>
  );

  if (showSplash) {
    return <OnyxSplash now={now} lat={lat} lon={lon} altM={altM} onEnter={onSplashDone} />;
  }

  if (mode === "sky") {
    return (
      <OnyxSky
        now={now}
        lat={lat}
        lon={lon}
        altM={altM ?? 0}
        headingDeg={headingDeg}
        pitchDeg={pitchDeg}
        onBack={() => setMode("home")}
        onTellMore={name => {
          onTellMore?.(name);
          setMode("oracle");
        }}
      />
    );
  }

  if (mode === "rings" && cosmic) {
    return (
      <div className="onyx-root">
        <div className="onyx-device" style={{ overflow: "auto", background: "#000" }}>
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div style={{ paddingTop: 48 }}>
            <DashboardContainer
              lat={lat}
              lon={lon}
              cosmic={cosmic}
              onRingSelect={onRingSelect}
              weather={
                cycles?.weather
                  ? {
                      emoji: cycles.weather.emoji,
                      condition: cycles.weather.condition,
                      tempC: cycles.weather.tempC ?? null,
                    }
                  : null
              }
              atlasReadings={stripReadings.filter(r =>
                ["hijri", "hebrew", "persian", "ethiopian", "chinese_lunisolar"].includes(r.systemId),
              )}
              showAtlasOnWheel={false}
              liveCoords
              usingFallback={false}
              locationDenied={false}
              locationEnabled
              accuracyM={null}
              altM={altM}
              altAccuracyM={null}
              speedMps={null}
              gpsHeading={null}
              locationAtMs={null}
              compassHeading={headingDeg}
              compassOffsetDeg={0}
              declinationDeg={0}
              pitchDeg={pitchDeg}
              emfUt={emfUt ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "tools") {
    return (
      <div className="onyx-root">
        <div className="onyx-device">
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay" style={{ position: "relative", background: "transparent" }}>
            <p className="onyx-eyebrow" style={{ marginTop: 8 }}>
              INSTRUMENTS
            </p>
            <div className="onyx-tools-grid">
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("rings")}>
                The rings
                <span>Cosmic clock wheel</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("atlas")}>
                Atlas
                <span>World cycle calendars</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("senses")}>
                Senses
                <span>Device instruments</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("oracle")}>
                Oracle
                <span>Ask / research</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("sky")}>
                Sky
                <span>Live sky with object details</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "atlas") {
    return (
      <div className="onyx-root">
        <div className="onyx-device" style={{ overflow: "auto" }}>
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <AtlasPanel prefs={cyclePrefs} onChange={onCyclePrefsChange} />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "senses") {
    return (
      <div className="onyx-root">
        <div className="onyx-device" style={{ overflow: "auto" }}>
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <EmfReader
              className="cp-card"
              emfUt={emfUt ?? null}
              live={Boolean(emfLive)}
              method={emfMethod ?? null}
              latDeg={lat}
            />
            <SensorArray className="cp-card" autoAwaken {...sensorProps} />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "oracle") {
    return (
      <div className="onyx-root">
        <div className="onyx-device" style={{ overflow: "auto" }}>
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <PauloVenturaHub className="cp-card" />
            {oracleExtra}
          </div>
        </div>
      </div>
    );
  }

  return (
    <OnyxHome
      now={now}
      phaseFraction={phaseFraction}
      moonAltDeg={moonAlt}
      zodiacSign={zodiacSign}
      momentLine={momentLine}
      selfTone={selfTone}
      selfRet={selfRet}
      calendarReadings={stripReadings.slice(0, 8)}
      onOpenSky={() => setMode("sky")}
      onOpenRings={() => setMode("rings")}
      onOpenTools={() => setMode("tools")}
    />
  );
}
