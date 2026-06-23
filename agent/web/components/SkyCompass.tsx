"use client";

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function cardinal(deg: number): string {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? "N";
}

export type SkyCompassProps = {
  headingDeg: number;
  live?: boolean;
  className?: string;
};

/** Standalone compass dial for the Sky tab — rotates with device heading. */
export function SkyCompass({ headingDeg, live = false, className = "" }: SkyCompassProps) {
  const h = ((headingDeg % 360) + 360) % 360;

  return (
    <div className={`cp-sky-compass${className ? ` ${className}` : ""}`} aria-label={`Compass heading ${Math.round(h)} degrees ${cardinal(h)}`}>
      <div className="cp-sky-compass-ring" style={{ transform: `rotate(${-h}deg)` }}>
        {["N", "E", "S", "W"].map(label => (
          <span
            key={label}
            className={`cp-sky-compass-cardinal cp-sky-compass-cardinal-${label.toLowerCase()}`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="cp-sky-compass-needle" aria-hidden />
      <div className="cp-sky-compass-readout">
        <span className="cp-sky-compass-deg">{Math.round(h)}°</span>
        <span className="cp-sky-compass-dir">{cardinal(h)}</span>
        <span className={`cp-sky-compass-live${live ? " cp-sky-compass-live-on" : ""}`}>
          {live ? "● live" : "○ manual"}
        </span>
      </div>
    </div>
  );
}
