"use client";

import type { CycleSnapshot } from "../lib/cycleSystems";
import type { CosmicClockState } from "../lib/cosmic";

const RING_NAMES: Record<string, string> = {
  ms: "Milliseconds",
  s: "Seconds",
  min: "Minutes",
  h: "Hours",
  weather: "Hourly Weather",
  day: "Day of Month",
  weekday: "Weekday",
  "chinese-sign": "Chinese Zodiac",
  tzolkin: "Tzolkin",
  moon: "Moon Phase",
  kin: "Mayan Kin",
  wavespell: "Wavespell",
  castle: "Mayan Castle",
  "greg-month": "Gregorian Month",
  zodiac: "Western Zodiac",
  season: "Season",
  "chinese-year": "Chinese Year",
  "greg-year": "Gregorian Year",
  "chinese-month": "Chinese Lunar Month",
};

function ringDetail(
  id: string,
  cycles: CycleSnapshot | null,
  cosmic: CosmicClockState | null,
  now: Date,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (!cycles) return rows;

  const g = cycles.gregorian;
  switch (id) {
    case "ms":
      rows.push({ label: "Now", value: `${now.getMilliseconds()} ms` });
      break;
    case "s":
      rows.push({ label: "Now", value: `${now.getSeconds()}.${String(now.getMilliseconds()).padStart(3, "0")} s` });
      break;
    case "min":
      rows.push({ label: "Now", value: `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, "0")}` });
      break;
    case "h":
      rows.push({ label: "Now", value: `${now.getHours()}:00 local` });
      break;
    case "weather":
      rows.push(
        { label: "Current", value: `${cycles.weather?.emoji ?? "·"} ${cycles.weather?.condition ?? "—"}` },
        { label: "Temp", value: cycles.weather?.tempC != null ? `${cycles.weather.tempC.toFixed(1)} °C` : "—" },
        { label: "Pressure", value: cycles.weather?.pressureHpa != null ? `${cycles.weather.pressureHpa.toFixed(1)} hPa` : "—" },
      );
      break;
    case "day":
      rows.push({ label: "Date", value: `${g.monthShort} ${g.day}, ${g.year}` }, { label: "Days in month", value: String(g.daysInMonth) });
      break;
    case "weekday":
      rows.push({ label: "Today", value: g.weekday });
      break;
    case "chinese-sign":
      rows.push({ label: "Sign", value: `${cycles.chineseZodiac.symbol} ${cycles.chineseZodiac.animal}` });
      break;
    case "tzolkin":
      rows.push({ label: "Kin", value: `${cycles.tzolkin.kin} · ${cycles.tzolkin.sign}` }, { label: "Tone", value: String(cycles.tzolkin.tone) });
      break;
    case "moon":
      rows.push({ label: "Phase", value: `${cycles.lunar.emoji} ${cycles.lunar.phase}` }, { label: "Illumination", value: `${(cycles.lunar.fraction * 100).toFixed(1)}%` });
      break;
    default: {
      const w = cycles.wheelLayers.find(l => l.id === id);
      if (w) rows.push({ label: w.name, value: w.label }, { label: "Detail", value: w.sublabel });
    }
  }

  const layer = cosmic?.layers.find(l => l.id === id || (id === "h" && l.id === "solar-day"));
  if (layer) {
    rows.push({ label: "Engine angle", value: `${layer.angleDeg.toFixed(3)}°` });
    for (const [k, v] of Object.entries(layer.meta)) {
      if (v != null) rows.push({ label: k, value: String(v) });
    }
  }

  if (cosmic && (id === "h" || id === "weather")) {
    rows.push(
      { label: "Solar noon", value: cosmic.solar.solarNoon.toLocaleTimeString() },
      { label: "Sunrise", value: cosmic.solar.sunrise.toLocaleTimeString() },
      { label: "Sunset", value: cosmic.solar.sunset.toLocaleTimeString() },
    );
  }

  return rows;
}

export function RingFocusPanel({
  ringId,
  cycles,
  cosmic,
  now,
  onClose,
}: {
  ringId: string;
  cycles: CycleSnapshot | null;
  cosmic: CosmicClockState | null;
  now: Date;
  onClose: () => void;
}) {
  const name = RING_NAMES[ringId] ?? ringId;
  const rows = ringDetail(ringId, cycles, cosmic, now);

  return (
    <div className="cp-ring-focus cp-tabular" role="dialog" aria-label={`${name} details`}>
      <div className="cp-ring-focus-head">
        <strong>{name}</strong>
        <button type="button" className="cp-btn cp-btn-sm" onClick={onClose}>✕</button>
      </div>
      <dl className="cp-ring-focus-grid">
        {rows.map(r => (
          <div key={r.label} className="cp-ring-focus-row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
        {rows.length === 0 && <p className="cp-muted">No metrics for this ring.</p>}
      </dl>
    </div>
  );
}

export function zoomForRingRadius(radius: number, semicircle = true): number {
  const viewSpan = semicircle ? 200 : 400;
  const target = viewSpan * 0.38;
  return Math.max(1.15, Math.min(2.8, target / Math.max(radius, 20)));
}
