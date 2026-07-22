"use client";

import { useMemo } from "react";
import { interpretEmf } from "../lib/emfField";

export type EmfReaderProps = {
  emfUt: number | null;
  live?: boolean;
  method?: string | null;
  latDeg?: number | null;
  className?: string;
};

export function EmfReader({
  emfUt,
  live = false,
  method,
  latDeg = null,
  className = "",
}: EmfReaderProps) {
  const reading = useMemo(() => {
    if (emfUt == null || !Number.isFinite(emfUt)) return null;
    return interpretEmf(emfUt, latDeg);
  }, [emfUt, latDeg]);

  const methodHint =
    method === "magnetometer-api-unavailable"
      ? "This browser has no magnetometer API — try Chrome on Android."
      : method === "magnetometer-denied"
        ? "Permission denied — allow motion / magnetic sensors for live EMF."
        : method === "magnetometer-timeout"
          ? "Sensor timed out — wake sensors again with the phone still."
          : method?.replace(/-/g, " ") ?? null;

  return (
    <section className={["cp-emf-reader", className].filter(Boolean).join(" ")} aria-label="EMF field reader">
      <div className="cp-emf-reader-header">
        <span className="cp-emf-reader-title">EMF Field</span>
        <span className={`cp-emf-reader-live${live ? " cp-emf-reader-live-on" : ""}`}>
          {live ? "● LIVE" : "○ IDLE"}
        </span>
      </div>

      <div className="cp-emf-gauge" aria-hidden>
        <svg viewBox="0 0 200 120" className="cp-emf-gauge-svg">
          <defs>
            <linearGradient id="cp-emf-arc" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="45%" stopColor="#34d399" />
              <stop offset="75%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
          </defs>
          <path
            d="M 24 100 A 76 76 0 0 1 176 100"
            fill="none"
            stroke="rgba(201, 162, 39, 0.15)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          {reading && (
            <path
              d="M 24 100 A 76 76 0 0 1 176 100"
              fill="none"
              stroke="url(#cp-emf-arc)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${(reading.pct / 100) * 239} 239`}
              className="cp-emf-arc-fill"
            />
          )}
          {reading && (
            <line
              x1={100}
              y1={100}
              x2={100 + Math.cos(Math.PI * (1 - reading.pct / 100)) * 62}
              y2={100 - Math.sin(Math.PI * (reading.pct / 100)) * 62}
              stroke={reading.color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}
          <circle cx={100} cy={100} r={5} fill="#c9a227" />
        </svg>
      </div>

      <p className="cp-emf-value">
        {reading ? (
          <>
            <span className="cp-emf-number" style={{ color: reading.color }}>{reading.ut.toFixed(1)}</span>
            <span className="cp-emf-unit">µT</span>
          </>
        ) : (
          <span className="cp-emf-number">—</span>
        )}
      </p>

      <p className="cp-emf-label">
        {reading ? reading.label : "Turn on EMF to taste the ambient magnetic field"}
      </p>

      {reading && reading.expectedUt != null && reading.anomalyPct != null && (
        <p className="cp-emf-baseline">
          Earth ~{reading.expectedUt.toFixed(0)} µT here
          <span className="cp-emf-anomaly">
            {" · "}
            {reading.anomalyPct >= 0 ? "+" : ""}
            {reading.anomalyPct.toFixed(0)}% vs calm Earth
          </span>
        </p>
      )}

      <p className="cp-emf-guidance">
        {reading
          ? reading.guidance
          : "When live, this keeps compass honest and warns when metal is bending your sky heading."}
      </p>

      {methodHint && (
        <p className="cp-emf-method">{methodHint}</p>
      )}
    </section>
  );
}
