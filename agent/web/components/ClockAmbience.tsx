"use client";

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
  const hue = 38 + warmth * 24;
  const breathScale = 1 + breath * 0.035;
  const rot = heading != null ? heading : 0;

  return (
    <div className="cp-clock-ambience" aria-hidden>
      <div
        className="cp-clock-aurora"
        style={{
          ["--amb-hue" as string]: String(hue),
          opacity: 0.35 + warmth * 0.45,
          transform: `rotate(${rot * 0.08}deg) scale(${breathScale})`,
        }}
      />
      <div className="cp-clock-nebula" style={{ transform: `rotate(${-rot * 0.05}deg)` }} />
      <div
        className={`cp-clock-pulse-ring${live ? " cp-clock-pulse-ring-live" : ""}`}
        style={{ transform: `scale(${breathScale})` }}
      />
      <div className="cp-clock-grain" />
    </div>
  );
}
