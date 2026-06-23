"use client";

import type { CosmicClockState } from "../lib/cosmic";
import type { CycleSnapshot } from "../lib/cycleSystems";

export type CosmicNowProps = {
  now: Date;
  lat: number;
  lon: number;
  liveCoords: boolean;
  usingFallback: boolean;
  altM: number | null;
  heading: number | null;
  liveHeading: boolean;
  cosmic: CosmicClockState | null;
  cycles: CycleSnapshot | null;
};

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function cardinal(deg: number): string {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? "N";
}

function fmtClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtHM(d: Date | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dayLength(sunrise?: Date, sunset?: Date): string {
  if (!sunrise || !sunset) return "";
  const ms = sunset.getTime() - sunrise.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m of daylight`;
}

function Tile({
  glyph, label, value, sub, accent, wide,
}: {
  glyph: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`cp-now-tile${wide ? " cp-now-tile-wide" : ""}`}
      style={accent ? { ["--tile-accent" as string]: accent } : undefined}
    >
      <span className="cp-now-glyph" aria-hidden>{glyph}</span>
      <div className="cp-now-body">
        <span className="cp-now-label">{label}</span>
        <span className="cp-now-value">{value}</span>
        {sub && <span className="cp-now-sub">{sub}</span>}
      </div>
    </div>
  );
}

export function CosmicNow(props: CosmicNowProps) {
  const { now, cosmic, cycles } = props;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace(/_/g, " ") ?? "local";

  const lunarFrac = cosmic?.lunarPhaseFraction ?? cycles?.lunar.fraction ?? null;
  const lit = lunarFrac != null ? Math.round((1 - Math.cos(2 * Math.PI * lunarFrac)) / 2 * 100) : null;

  const sunSign = (cosmic?.layers.find(l => l.id === "sun-ecliptic")?.meta.sign as string | undefined)
    ?? cycles?.westernZodiac.sign;

  const place = `${props.lat.toFixed(2)}°, ${props.lon.toFixed(2)}°`;
  const placeSub = props.liveCoords
    ? (props.altM != null ? `live · ${Math.round(props.altM)} m alt` : "live fix")
    : props.usingFallback ? "approx · tap Locate" : "—";

  return (
    <div className="cp-now-grid">
      <Tile
        glyph="🕐"
        label="Local Time"
        value={fmtClock(now)}
        sub={tz}
        accent="var(--gold)"
        wide
      />

      <Tile
        glyph="📍"
        label="Position"
        value={place}
        sub={placeSub}
        accent="#7dd3fc"
      />

      {cycles && (
        <Tile
          glyph={cycles.weather?.emoji ?? "🌡️"}
          label="Weather"
          value={cycles.weather?.condition ?? "—"}
          sub={cosmic?.sensors.pressureHpa != null ? `${cosmic.sensors.pressureHpa.toFixed(0)} hPa` : undefined}
          accent="#38bdf8"
        />
      )}

      {cosmic && (
        <Tile
          glyph="☀️"
          label="Sun"
          value={`↑ ${fmtHM(cosmic.solar.sunrise)}   ↓ ${fmtHM(cosmic.solar.sunset)}`}
          sub={dayLength(cosmic.solar.sunrise, cosmic.solar.sunset)}
          accent="#f5d78e"
          wide
        />
      )}

      {cycles && (
        <Tile
          glyph={cycles.lunar.emoji}
          label="Moon"
          value={cycles.lunar.phase}
          sub={lit != null ? `${lit}% illuminated` : undefined}
          accent="#cbd5e1"
        />
      )}

      {sunSign && (
        <Tile
          glyph={cycles?.westernZodiac.symbol ?? "✶"}
          label="Zodiac"
          value={sunSign}
          sub="Sun sign"
          accent="#c084fc"
        />
      )}

      {cycles && (
        <Tile
          glyph={cycles.chineseZodiac.symbol}
          label="Chinese Year"
          value={`${cycles.chineseZodiac.element} ${cycles.chineseZodiac.animal}`}
          accent="#f87171"
        />
      )}

      {cycles && (
        <Tile
          glyph={cycles.season.emoji}
          label="Season"
          value={cycles.season.name}
          accent="#34d399"
        />
      )}

      {props.heading != null && (
        <Tile
          glyph="🧭"
          label="Heading"
          value={`${Math.round(props.heading)}° ${cardinal(props.heading)}`}
          sub={props.liveHeading ? "live compass" : "manual"}
          accent="#9174f8"
        />
      )}
    </div>
  );
}
