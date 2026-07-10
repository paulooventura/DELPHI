"use client";

import { useMemo } from "react";

export type EmfReaderProps = {
  emfUt: number | null;
  live?: boolean;
  method?: string;
  className?: string;
};

/** Earth's field ~25–65 µT; typical phone magnetometer range. */
function emfLevel(ut: number): { label: string; pct: number; color: string } {
  if (ut < 25) return { label: "Quiet", pct: (ut / 25) * 35, color: "#60a5fa" };
  if (ut < 45) return { label: "Earth-normal", pct: 35 + ((ut - 25) / 20) * 35, color: "#34d399" };
  if (ut < 70) return { label: "Elevated", pct: 70 + ((ut - 45) / 25) * 20, color: "#fbbf24" };
  return { label: "Strong", pct: Math.min(100, 90 + (ut - 70) / 2), color: "#f87171" };
}

export function EmfReader({ emfUt, live = false, method, className = "" }: EmfReaderProps) {
  const reading = useMemo(() => {
    if (emfUt == null || !Number.isFinite(emfUt)) return null;
    return { ut: emfUt, ...emfLevel(emfUt) };
  }, [emfUt]);

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
            <span className="cp-emf-number">{reading.ut.toFixed(2)}</span>
            <span className="cp-emf-unit">µT</span>
          </>
        ) : (
          <span className="cp-emf-number">—</span>
        )}
      </p>

      <p className="cp-emf-label">
        {reading ? reading.label : "Enable EMF sensor to read ambient magnetic field"}
      </p>

      {method && (
        <p className="cp-emf-method">via {method.replace(/-/g, " ")}</p>
      )}
    </section>
  );
}
