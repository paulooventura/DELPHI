"use client";

import { useEffect, useRef } from "react";

/** Living backdrop behind the cosmic wheel — aurora, breath, sensor pulse. */
export function ClockAmbience({
  warmth = 0.55,
  breath = 0,
  live = false,
  heading,
}: {
  warmth?: number;
  breath?: number;
  live?: boolean;
  heading?: number | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hue = 38 + warmth * 24;
  const breathScale = 1 + breath * 0.04;
  const rot = heading != null ? heading : 0;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let frame = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      el.style.setProperty("--amb-phase", String(t));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={rootRef} className="cp-clock-ambience" aria-hidden style={{ ["--amb-phase" as string]: "0" }}>
      <div className="cp-clock-stars" />
      <div
        className="cp-clock-aurora"
        style={{
          ["--amb-hue" as string]: String(hue),
          opacity: 0.38 + warmth * 0.48,
          transform: `rotate(${rot * 0.08}deg) scale(${breathScale})`,
        }}
      />
      <div
        className="cp-clock-aurora cp-clock-aurora-alt"
        style={{
          ["--amb-hue" as string]: String(hue + 18),
          opacity: 0.22 + warmth * 0.28,
          transform: `rotate(${-rot * 0.06 + 12}deg) scale(${breathScale * 1.04})`,
        }}
      />
      <div className="cp-clock-nebula" style={{ transform: `rotate(${-rot * 0.05}deg) scale(${breathScale})` }} />
      <div
        className={`cp-clock-pulse-ring${live ? " cp-clock-pulse-ring-live" : ""}`}
        style={{ transform: `scale(${breathScale})` }}
      />
      <div className="cp-clock-orbit-traces" />
      <div className="cp-clock-grain" />
    </div>
  );
}
