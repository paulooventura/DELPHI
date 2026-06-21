"use client";

import type React from "react";
import { useDeviceSensors } from "../hooks/useDeviceSensors";
import type { SensorStatus } from "../lib/deviceSensors";
import "./sensorArray.css";

export type SensorArrayProps = {
  className?: string;
  /** Surface ambient readings up so the parent can feed the cosmic engine. */
  onAmbient?: (a: { lux: number | null; pressureHpa: number | null }) => void;
};

const CHIP_LABEL: Record<SensorStatus, string> = {
  live: "live",
  idle: "idle",
  "permission-required": "permission",
  denied: "denied",
  unsupported: "n/a",
};

function chipClass(status: SensorStatus): string {
  switch (status) {
    case "live":
      return "cp-sensor-chip cp-sensor-chip-live";
    case "permission-required":
      return "cp-sensor-chip cp-sensor-chip-permission";
    case "idle":
      return "cp-sensor-chip cp-sensor-chip-idle";
    default:
      return `cp-sensor-chip cp-sensor-chip-${status}`;
  }
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtSigned(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function clampPct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

type TileProps = {
  label: string;
  glyph: string;
  status: SensorStatus;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  meter?: { pct: number; variant?: string; battery?: boolean; batteryLow?: boolean };
  action?: React.ReactNode;
};

function Tile({ label, glyph, status, value, unit, sub, meter, action }: TileProps) {
  const live = status === "live";
  const inactive = status === "denied" || status === "unsupported";
  const tileClass = [
    "cp-sensor-tile",
    live ? "cp-sensor-tile-live" : "",
    inactive ? "cp-sensor-tile-dim" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={tileClass}>
      <div className="cp-sensor-tile-row">
        <span className="cp-sensor-label">
          <span className="cp-sensor-glyph" aria-hidden="true">
            {glyph}
          </span>
          {label}
        </span>
        <span className={chipClass(status)}>{CHIP_LABEL[status]}</span>
      </div>
      <div>
        <span className="cp-sensor-value">{value}</span>
        {unit ? <span className="cp-sensor-unit">{unit}</span> : null}
      </div>
      {meter ? (
        <div
          className={[
            meter.battery ? "cp-sensor-battery" : "cp-sensor-meter",
            meter.batteryLow ? "cp-sensor-battery-low" : "",
            meter.variant ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className="cp-sensor-meter-fill"
            style={{ width: `${Math.max(0, Math.min(100, meter.pct))}%` }}
          />
        </div>
      ) : null}
      {sub ? <div className="cp-sensor-sub">{sub}</div> : null}
      {action ? <div className="cp-sensor-actions">{action}</div> : null}
    </div>
  );
}

export function SensorArray(props: SensorArrayProps): React.ReactElement {
  const { state, controls } = useDeviceSensors({ onAmbient: props.onAmbient });

  const m = state.motion;
  const motionGated = m.status === "permission-required" || m.status === "denied";

  const dbPct =
    state.mic.db != null ? clampPct(state.mic.db, -80, 0) : 0;
  const gForcePct = m.gForce != null ? clampPct(m.gForce, 0, 3) : 0;
  const luxPct = state.light.lux != null ? clampPct(Math.log10(state.light.lux + 1), 0, 4) : 0;
  const tiltPct = m.tiltDeg != null ? clampPct(m.tiltDeg, 0, 180) : 0;
  const utPct = state.magnetometer.ut != null ? clampPct(state.magnetometer.ut, 0, 120) : 0;
  const shakePct =
    state.shake.intensity != null ? clampPct(state.shake.intensity, 0, 40) : 0;
  const cadencePct =
    state.steps.cadenceSpm != null ? clampPct(state.steps.cadenceSpm, 0, 200) : 0;
  const batteryLevelPct = state.battery.level != null ? state.battery.level * 100 : 0;

  const rootClass = props.className
    ? `cp-sensor-array ${props.className}`
    : "cp-sensor-array";

  return (
    <div className={rootClass}>
      <div className="cp-sensor-head">
        <div>
          <div className="cp-sensor-title">Oracle Senses</div>
          <div className="cp-sensor-subtitle">device telemetry · live</div>
        </div>
        <div className="cp-sensor-actions">
          {motionGated ? (
            <button
              type="button"
              className="cp-sensor-btn"
              onClick={() => void controls.enableMotion()}
            >
              Enable motion
            </button>
          ) : null}
          {state.mic.status === "live" ? (
            <button
              type="button"
              className="cp-sensor-btn cp-sensor-btn-on"
              onClick={() => controls.disableMic()}
            >
              Mute mic
            </button>
          ) : (
            <button
              type="button"
              className="cp-sensor-btn"
              disabled={state.mic.status === "unsupported"}
              onClick={() => void controls.enableMic()}
            >
              Enable mic
            </button>
          )}
        </div>
      </div>

      <div className="cp-sensor-grid">
        {/* Accelerometer (incl. gravity) + tilt */}
        <Tile
          label="Accel + Tilt"
          glyph="📐"
          status={m.status}
          value={fmt(m.tiltDeg, 0)}
          unit="° tilt"
          sub={`x ${fmt(m.accelG.x, 1)} · y ${fmt(m.accelG.y, 1)} · z ${fmt(m.accelG.z, 1)} m/s²`}
          meter={{ pct: tiltPct, variant: "cp-sensor-meter-cyan" }}
        />

        {/* Linear acceleration + g-force */}
        <Tile
          label="Linear g-force"
          glyph="🚀"
          status={m.status}
          value={fmt(m.gForce, 2)}
          unit="g"
          sub={`x ${fmt(m.accel.x, 1)} · y ${fmt(m.accel.y, 1)} · z ${fmt(m.accel.z, 1)} m/s²`}
          meter={{ pct: gForcePct }}
        />

        {/* Gyroscope */}
        <Tile
          label="Gyroscope"
          glyph="🌀"
          status={m.status}
          value={fmt(m.rotation.alpha, 0)}
          unit="°/s α"
          sub={`β ${fmt(m.rotation.beta, 0)} · γ ${fmt(m.rotation.gamma, 0)} °/s`}
          meter={{ pct: clampPct(Math.abs(m.rotation.alpha ?? 0), 0, 360), variant: "cp-sensor-meter-purple" }}
        />

        {/* Shake */}
        <Tile
          label="Shake"
          glyph="💥"
          status={state.shake.status}
          value={state.shake.count}
          unit="shakes"
          sub={`intensity ${fmt(state.shake.intensity, 1)} m/s²`}
          meter={{ pct: shakePct }}
        />

        {/* Pedometer */}
        <Tile
          label="Pedometer"
          glyph="👣"
          status={state.steps.status}
          value={state.steps.count}
          unit="steps"
          sub={`cadence ${fmt(state.steps.cadenceSpm, 0)} spm`}
          meter={{ pct: cadencePct, variant: "cp-sensor-meter-ok" }}
        />

        {/* Ambient light */}
        <Tile
          label="Ambient Light"
          glyph="☀️"
          status={state.light.status}
          value={fmt(state.light.lux, 0)}
          unit="lux"
          meter={{ pct: luxPct }}
        />

        {/* Proximity */}
        <Tile
          label="Proximity"
          glyph="📡"
          status={state.proximity.status}
          value={
            state.proximity.near == null
              ? state.proximity.distanceCm == null
                ? "—"
                : fmt(state.proximity.distanceCm, 1)
              : state.proximity.near
                ? "NEAR"
                : "FAR"
          }
          unit={state.proximity.distanceCm != null ? "cm" : undefined}
          sub={
            state.proximity.distanceCm != null
              ? `distance ${fmt(state.proximity.distanceCm, 1)} cm`
              : undefined
          }
        />

        {/* Battery */}
        <Tile
          label="Battery"
          glyph={state.battery.charging ? "🔌" : "🔋"}
          status={state.battery.status}
          value={state.battery.level != null ? fmt(batteryLevelPct, 0) : "—"}
          unit="%"
          sub={
            state.battery.charging
              ? `charging · full in ${fmtDuration(state.battery.chargingTimeS)}`
              : `empty in ${fmtDuration(state.battery.dischargingTimeS)}`
          }
          meter={{
            pct: batteryLevelPct,
            battery: true,
            batteryLow: batteryLevelPct <= 20 && !state.battery.charging,
          }}
        />

        {/* Microphone */}
        <Tile
          label="Microphone"
          glyph="🎙️"
          status={state.mic.status}
          value={state.mic.db != null ? fmt(state.mic.db, 1) : "—"}
          unit="dBFS"
          sub={state.mic.freqHz != null ? `peak ${fmt(state.mic.freqHz, 0)} Hz` : "opt-in required"}
          meter={{ pct: dbPct, variant: "cp-sensor-meter-cyan" }}
        />

        {/* Pressure / barometer */}
        <Tile
          label="Barometer"
          glyph="🌡️"
          status={state.pressure.status}
          value={fmt(state.pressure.hpa, 1)}
          unit="hPa"
          sub={
            state.pressure.hpa != null
              ? `Δ ${fmtSigned(state.pressure.hpa - 1013.25, 1)} hPa`
              : state.pressure.method === "compute-pressure"
                ? "compute-pressure (no hPa)"
                : undefined
          }
          meter={{ pct: clampPct(state.pressure.hpa ?? 1013.25, 950, 1050) }}
        />

        {/* Magnetometer */}
        <Tile
          label="Magnetometer"
          glyph="🧲"
          status={state.magnetometer.status}
          value={fmt(state.magnetometer.ut, 1)}
          unit="µT"
          meter={{ pct: utPct, variant: "cp-sensor-meter-purple" }}
        />

        {/* Screen orientation */}
        <Tile
          label="Orientation"
          glyph="🧭"
          status={state.orientation.status}
          value={fmt(state.orientation.angle, 0)}
          unit="°"
          sub={state.orientation.type ?? "unknown"}
        />

        {/* Hardware / context */}
        <Tile
          label="Hardware"
          glyph="⚙️"
          status="live"
          value={fmt(state.hardware.cores, 0)}
          unit="cores"
          sub={
            <>
              {state.hardware.deviceMemoryGb != null ? `${state.hardware.deviceMemoryGb} GB · ` : ""}
              dpr {fmt(state.hardware.pixelRatio, 2)} · touch {fmt(state.hardware.maxTouchPoints, 0)} ·{" "}
              {state.hardware.online == null ? "?" : state.hardware.online ? "online" : "offline"}
            </>
          }
        />

        {/* Vibration output */}
        <Tile
          label="Vibration"
          glyph="📳"
          status={state.vibration.status === "unsupported" ? "unsupported" : "idle"}
          value="Pulse"
          sub={state.vibration.status === "unsupported" ? "no motor (desktop)" : "tap to buzz"}
          action={
            <button
              type="button"
              className="cp-sensor-btn"
              disabled={state.vibration.status === "unsupported"}
              onClick={() => controls.pulse()}
            >
              Pulse
            </button>
          }
        />

        {/* Wake lock output */}
        <Tile
          label="Wake Lock"
          glyph={state.wakeLock.active ? "👁️" : "💤"}
          status={
            state.wakeLock.status === "unsupported"
              ? "unsupported"
              : state.wakeLock.active
                ? "live"
                : "idle"
          }
          value={state.wakeLock.active ? "AWAKE" : "OFF"}
          sub={state.wakeLock.status === "unsupported" ? "unsupported" : "keep screen on"}
          action={
            <button
              type="button"
              className={
                state.wakeLock.active ? "cp-sensor-btn cp-sensor-btn-on" : "cp-sensor-btn"
              }
              disabled={state.wakeLock.status === "unsupported"}
              onClick={() => void controls.toggleWakeLock()}
            >
              {state.wakeLock.active ? "Release" : "Stay awake"}
            </button>
          }
        />
      </div>

      <div className="cp-sensor-foot">
        <span>
          lux <strong>{fmt(state.light.lux, 0)}</strong>
        </span>
        <span>
          pressure <strong>{fmt(state.pressure.hpa, 1)}</strong> hPa
        </span>
      </div>
    </div>
  );
}
