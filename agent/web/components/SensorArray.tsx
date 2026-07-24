"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeviceSensors } from "../hooks/useDeviceSensors";
import type { SensorStatus } from "../lib/deviceSensors";
import { SENSOR_HINTS } from "../lib/platform";
import { sensorLore } from "../lib/sensorLore";
import { SensesSpeedDial } from "./SensesSpeedDial";
import "./sensorArray.css";

export type SensorArrayProps = {
  className?: string;
  onAmbient?: (a: { lux: number | null; pressureHpa: number | null }) => void;
  weatherPressureHpa?: number | null;
  estimatedLux?: number | null;
  /** GPS ground speed (m/s) for the speed dial. */
  speedMps?: number | null;
  headingDeg?: number | null;
  /** Parent hook: enable location + orientation when the oracle eye opens. */
  onAwaken?: () => void | Promise<void>;
  /** Open all device senses automatically on mount (app opens ready). */
  autoAwaken?: boolean;
};

/**
 * Status is shown BY EXCEPTION. Both "live" and "idle" are ordinary states — labelling
 * every tile with them spent a bordered pill of visual weight to say nothing. Live gets a
 * quiet green dot; idle gets silence; only states that need attention get words.
 */
const CHIP_LABEL: Partial<Record<SensorStatus, string>> = {
  "permission-required": "permission",
  denied: "denied",
  unsupported: "n/a",
};

const SHOW_UNSUPPORTED_KEY = "delphi.senses.showUnsupported";

function chipClass(status: SensorStatus): string {
  if (status === "permission-required") return "cp-sensor-chip cp-sensor-chip-permission";
  if (status === "unsupported") return "cp-sensor-chip cp-sensor-chip-unsupported";
  return `cp-sensor-chip cp-sensor-chip-${status}`;
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

function loadShownUnsupported(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SHOW_UNSUPPORTED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

/** Instrument clusters. Each carries an accent so a group reads as one bank of dials. */
type GroupId = "motion" | "environment" | "device";

const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: "motion", label: "Motion" },
  { id: "environment", label: "Environment" },
  { id: "device", label: "Device" },
];

type TileProps = {
  label: string;
  glyph: string;
  status: SensorStatus;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  meter?: { pct: number; variant?: string; battery?: boolean; batteryLow?: boolean };
  action?: React.ReactNode;
  onOpen?: () => void;
};

type SensorSpec = TileProps & { id: string; group: GroupId };

function Tile({ label, glyph, status, value, unit, sub, meter, action, onOpen }: TileProps) {
  const live = status === "live";
  const inactive = status === "denied" || status === "unsupported";
  const tileClass = [
    "cp-sensor-tile",
    live ? "cp-sensor-tile-live" : "",
    inactive ? "cp-sensor-tile-dim" : "",
    onOpen ? "cp-sensor-tile-tappable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={tileClass}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      aria-label={onOpen ? `${label} details` : undefined}
    >
      <div className="cp-sensor-tile-row">
        <span className="cp-sensor-label">
          <span className="cp-sensor-glyph" aria-hidden="true">
            {glyph}
          </span>
          {label}
        </span>
        {live ? (
          <span className="cp-sensor-dot" role="img" aria-label="live" />
        ) : CHIP_LABEL[status] ? (
          <span className={chipClass(status)}>{CHIP_LABEL[status]}</span>
        ) : null}
      </div>
      <div className="cp-sensor-readout">
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
      {action ? (
        <div
          className="cp-sensor-actions"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

function SenseDetailSheet({
  sensorId,
  status,
  liveValue,
  onClose,
}: {
  sensorId: string;
  status: SensorStatus;
  liveValue: string;
  onClose: () => void;
}) {
  const lore = sensorLore(sensorId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!lore) return null;

  return (
    <div className="cp-sense-sheet-root" role="presentation">
      <button type="button" className="cp-sense-sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="cp-sense-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-sense-sheet-title"
      >
        <header className="cp-sense-sheet-head">
          <span className="cp-sense-sheet-glyph" aria-hidden>
            {lore.glyph}
          </span>
          <div>
            <h2 id="cp-sense-sheet-title">{lore.title}</h2>
            <p className="cp-sense-sheet-live">
              Now · <strong>{liveValue}</strong>
              {status === "unsupported" ? " · not on this device" : ` · ${status}`}
            </p>
          </div>
          <button type="button" className="cp-sense-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="cp-sense-sheet-body">
          <section>
            <h3>Instrument</h3>
            <p>{lore.technical}</p>
          </section>
          <section>
            <h3>Cultural read</h3>
            <p>{lore.cultural}</p>
          </section>
          <section>
            <h3>In DELPHI</h3>
            <p>{lore.delphi}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SensorArray(props: SensorArrayProps): React.ReactElement {
  const { state, controls } = useDeviceSensors({
    onAmbient: props.onAmbient,
    weatherPressureHpa: props.weatherPressureHpa,
    estimatedLux: props.estimatedLux,
  });
  const [awake, setAwake] = useState(false);
  const [awakening, setAwakening] = useState(false);
  const [shownUnsupported, setShownUnsupported] = useState<Set<string>>(() => loadShownUnsupported());
  const [openId, setOpenId] = useState<string | null>(null);

  const awaken = useCallback(async () => {
    if (awakening) return;
    setAwakening(true);
    try {
      await controls.enableAll();
      await props.onAwaken?.();
      setAwake(true);
    } finally {
      setAwakening(false);
    }
  }, [awakening, controls, props.onAwaken]);

  useEffect(() => {
    if (!props.autoAwaken || awake || awakening) return;
    void awaken();
  }, [props.autoAwaken, awake, awakening, awaken]);

  const toggleUnsupported = useCallback((id: string) => {
    setShownUnsupported((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(SHOW_UNSUPPORTED_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  const m = state.motion;
  const motionLive = m.status === "live";

  const dbPct = state.mic.db != null ? clampPct(state.mic.db, -80, 0) : 0;
  const gForcePct = m.gForce != null ? clampPct(m.gForce, 0, 3) : 0;
  const luxPct = state.light.lux != null ? clampPct(Math.log10(state.light.lux + 1), 0, 4) : 0;
  const tiltPct = m.tiltDeg != null ? clampPct(m.tiltDeg, 0, 180) : 0;
  const utPct = state.magnetometer.ut != null ? clampPct(state.magnetometer.ut, 0, 120) : 0;
  const shakePct = state.shake.intensity != null ? clampPct(state.shake.intensity, 0, 40) : 0;
  const cadencePct = state.steps.cadenceSpm != null ? clampPct(state.steps.cadenceSpm, 0, 200) : 0;
  const batteryLevelPct = state.battery.level != null ? state.battery.level * 100 : 0;

  const rootClass = props.className
    ? `cp-sensor-array ${props.className}`
    : "cp-sensor-array";

  const specs: SensorSpec[] = useMemo(
    () => [
      {
        id: "tilt",
        group: "motion",
        label: "Accel + Tilt",
        glyph: "📐",
        status: m.status,
        value: fmt(m.tiltDeg, 0),
        unit: "° tilt",
        sub: motionLive
          ? `x ${fmt(m.accelG.x, 1)} · y ${fmt(m.accelG.y, 1)} · z ${fmt(m.accelG.z, 1)} m/s²`
          : undefined,
        meter: { pct: tiltPct, variant: "cp-sensor-meter-cyan" },
      },
      {
        id: "gforce",
        group: "motion",
        label: "Linear g-force",
        glyph: "🚀",
        status: m.status,
        value: fmt(m.gForce, 2),
        unit: "g",
        sub: motionLive
          ? `x ${fmt(m.accel.x, 1)} · y ${fmt(m.accel.y, 1)} · z ${fmt(m.accel.z, 1)} m/s²`
          : undefined,
        meter: { pct: gForcePct },
      },
      {
        id: "gyro",
        group: "motion",
        label: "Gyroscope",
        glyph: "🌀",
        status: m.status,
        value: fmt(m.rotation.alpha, 0),
        unit: "°/s α",
        sub: motionLive ? `β ${fmt(m.rotation.beta, 0)} · γ ${fmt(m.rotation.gamma, 0)} °/s` : undefined,
        meter: {
          pct: clampPct(Math.abs(m.rotation.alpha ?? 0), 0, 360),
          variant: "cp-sensor-meter-purple",
        },
      },
      {
        id: "shake",
        group: "motion",
        label: "Shake",
        glyph: "💥",
        status: state.shake.status,
        value: state.shake.count,
        unit: "shakes",
        sub: `intensity ${fmt(state.shake.intensity, 1)} m/s²`,
        meter: { pct: shakePct },
      },
      {
        id: "steps",
        group: "motion",
        label: "Pedometer",
        glyph: "👣",
        status: state.steps.status,
        value: state.steps.count,
        unit: "steps",
        sub:
          state.steps.status === "live"
            ? `cadence ${fmt(state.steps.cadenceSpm, 0)} spm`
            : "enable motion to count",
        meter: { pct: cadencePct, variant: "cp-sensor-meter-ok" },
      },
      {
        id: "light",
        group: "environment",
        label: "Ambient Light",
        glyph: "☀️",
        status: state.light.status,
        value: fmt(state.light.lux, 0),
        unit: "lux",
        sub:
          state.light.source === "estimated"
            ? "estimated from sun position"
            : state.light.status === "unsupported"
              ? SENSOR_HINTS.ambientLight
              : undefined,
        meter: { pct: luxPct },
      },
      {
        id: "mic",
        group: "environment",
        label: "Microphone",
        glyph: "🎙️",
        status: state.mic.status,
        value: state.mic.db != null ? fmt(state.mic.db, 1) : "—",
        unit: "dBFS",
        sub: state.mic.freqHz != null ? `peak ${fmt(state.mic.freqHz, 0)} Hz` : "opt-in required",
        meter: { pct: dbPct, variant: "cp-sensor-meter-cyan" },
      },
      {
        id: "pressure",
        group: "environment",
        label: "Barometer",
        glyph: "🌡️",
        status: state.pressure.status,
        value: fmt(state.pressure.hpa, 1),
        unit: "hPa",
        sub:
          state.pressure.hpa != null
            ? `Δ ${fmtSigned(state.pressure.hpa - 1013.25, 1)} hPa${state.pressure.source === "weather" ? " · weather" : ""}`
            : SENSOR_HINTS.barometer,
        meter: { pct: clampPct(state.pressure.hpa ?? 1013.25, 950, 1050) },
      },
      {
        id: "magnet",
        group: "environment",
        label: "Magnetometer",
        glyph: "🧲",
        status: state.magnetometer.status,
        value: fmt(state.magnetometer.ut, 1),
        unit: "µT",
        sub: state.magnetometer.status === "live" ? undefined : SENSOR_HINTS.magnetometer,
        meter: { pct: utPct, variant: "cp-sensor-meter-purple" },
      },
      {
        id: "proximity",
        group: "environment",
        label: "Proximity",
        glyph: "📡",
        status: state.proximity.status,
        value:
          state.proximity.near == null
            ? state.proximity.distanceCm == null
              ? state.proximity.status === "unsupported"
                ? "N/A"
                : "—"
              : fmt(state.proximity.distanceCm, 1)
            : state.proximity.near
              ? "NEAR"
              : "FAR",
        unit: state.proximity.distanceCm != null ? "cm" : undefined,
        sub: state.proximity.status === "live" ? undefined : SENSOR_HINTS.proximity,
      },
      {
        id: "battery",
        group: "device",
        label: "Battery",
        glyph: state.battery.charging ? "🔌" : "🔋",
        status: state.battery.status,
        value: state.battery.level != null ? fmt(batteryLevelPct, 0) : "N/A",
        unit: state.battery.level != null ? "%" : undefined,
        sub:
          state.battery.status === "unsupported"
            ? SENSOR_HINTS.battery
            : state.battery.charging
              ? `charging · full in ${fmtDuration(state.battery.chargingTimeS)}`
              : `empty in ${fmtDuration(state.battery.dischargingTimeS)}`,
        meter: {
          pct: batteryLevelPct,
          battery: true,
          batteryLow: batteryLevelPct <= 20 && !state.battery.charging,
        },
      },
      {
        id: "orientation",
        group: "device",
        label: "Orientation",
        glyph: "🧭",
        status: state.orientation.status,
        value: fmt(state.orientation.angle, 0),
        unit: "°",
        sub: state.orientation.type ?? "unknown",
      },
      {
        id: "hardware",
        group: "device",
        label: "Hardware",
        glyph: "⚙️",
        status: "live",
        value: fmt(state.hardware.cores, 0),
        unit: "cores",
        sub: (
          <>
            {state.hardware.deviceMemoryGb != null ? `${state.hardware.deviceMemoryGb} GB · ` : ""}
            dpr {fmt(state.hardware.pixelRatio, 2)} ·{" "}
            {state.hardware.online == null ? "?" : state.hardware.online ? "online" : "offline"}
          </>
        ),
      },
      {
        id: "vibration",
        group: "device",
        label: "Vibration",
        glyph: "📳",
        status: state.vibration.status,
        value: state.vibration.status === "unsupported" ? "N/A" : "Pulse",
        sub: state.vibration.status === "unsupported" ? SENSOR_HINTS.vibration : undefined,
        action: (
          <button
            type="button"
            className="cp-sensor-btn"
            disabled={state.vibration.status === "unsupported"}
            onClick={() => controls.pulse()}
          >
            Pulse
          </button>
        ),
      },
      {
        id: "wakelock",
        group: "device",
        label: "Wake Lock",
        glyph: state.wakeLock.active ? "👁️" : "💤",
        status:
          state.wakeLock.status === "unsupported"
            ? "unsupported"
            : state.wakeLock.active
              ? "live"
              : "idle",
        value: state.wakeLock.active ? "AWAKE" : "OFF",
        sub: state.wakeLock.status === "unsupported" ? undefined : "keep screen on",
        action: (
          <button
            type="button"
            className={state.wakeLock.active ? "cp-sensor-btn cp-sensor-btn-on" : "cp-sensor-btn"}
            disabled={state.wakeLock.status === "unsupported"}
            onClick={() => void controls.toggleWakeLock()}
          >
            {state.wakeLock.active ? "Release" : "Stay awake"}
          </button>
        ),
      },
    ],
    [
      m,
      motionLive,
      state,
      tiltPct,
      gForcePct,
      shakePct,
      cadencePct,
      luxPct,
      dbPct,
      utPct,
      batteryLevelPct,
      controls,
    ],
  );

  // Unsupported senses stay off the grid until ticked on — then they reappear as dim N/A
  // cards so the instrument bank stays complete without forcing empty tiles by default.
  const missing = specs.filter((s) => s.status === "unsupported");
  const visible = specs.filter(
    (s) => s.status !== "unsupported" || shownUnsupported.has(s.id),
  );

  const openSpec = openId ? specs.find((s) => s.id === openId) : undefined;
  const openLiveValue = openSpec
    ? `${typeof openSpec.value === "string" || typeof openSpec.value === "number" ? openSpec.value : "—"}${openSpec.unit ? ` ${openSpec.unit}` : ""}`
    : "";

  return (
    <div className={rootClass}>
      <button
        type="button"
        className={`cp-oracle-eye${awake ? " cp-oracle-eye-open" : ""}${awakening ? " cp-oracle-eye-busy" : ""}`}
        onClick={() => void awaken()}
        disabled={awakening}
        aria-label={awake ? "Oracle senses active" : "Awaken oracle senses — enable all device sensors"}
      >
        <span className="cp-oracle-eye-icon" aria-hidden>
          {awake ? "👁" : "👁‍🗨"}
        </span>
        <span className="cp-oracle-eye-text">
          {awakening ? "Awakening…" : awake ? "Oracle senses live" : "Tap to awaken all senses"}
        </span>
        <span className="cp-oracle-eye-hint">
          {awake ? "motion · mic · location · orientation" : "closed — permissions required"}
        </span>
      </button>

      <SensesSpeedDial
        speedMps={props.speedMps ?? null}
        gForce={m.gForce}
        cadenceSpm={state.steps.cadenceSpm}
        headingDeg={props.headingDeg ?? null}
        live={motionLive || props.speedMps != null}
      />

      <p className="cp-sensor-tap-hint">Tap any sense for technical + cultural detail.</p>

      {GROUPS.map((group) => {
        const tiles = visible.filter((s) => s.group === group.id);
        if (tiles.length === 0) return null;
        return (
          <section key={group.id} className={`cp-sensor-group cp-sensor-group-${group.id}`}>
            <h3 className="cp-sensor-group-head">
              <span>{group.label}</span>
            </h3>
            <div className="cp-sensor-grid">
              {tiles.map((tile) => (
                <Tile key={tile.id} {...tile} onOpen={() => setOpenId(tile.id)} />
              ))}
            </div>
          </section>
        );
      })}

      {missing.length > 0 ? (
        <div className="cp-sensor-missing">
          <span className="cp-sensor-missing-label">Not on this device — tick to show</span>
          <div className="cp-sensor-missing-toggles" role="group" aria-label="Show unavailable senses">
            {missing.map((s) => {
              const on = shownUnsupported.has(s.id);
              return (
                <label key={s.id} className={`cp-sensor-tick${on ? " cp-sensor-tick-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleUnsupported(s.id)}
                  />
                  <span aria-hidden>{s.glyph}</span>
                  <span>{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {openId && openSpec ? (
        <SenseDetailSheet
          sensorId={openId}
          status={openSpec.status}
          liveValue={openLiveValue}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
