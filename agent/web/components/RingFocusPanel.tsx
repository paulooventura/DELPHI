"use client";

import type { CycleSnapshot } from "../lib/cycleSystems";
import type { CosmicClockState } from "../lib/cosmic";
import type { ClockRingData } from "../lib/timeEngine";
import { claimSentence } from "../lib/design/claimMarks";

const RING_NAMES: Record<string, string> = {
  ms: "Milliseconds",
  s: "Seconds",
  min: "Minutes",
  h: "Hours",
  weather: "Hourly Weather",
  day: "Day of Month",
  weekday: "Weekday",
  "chinese-sign": "Chinese Zodiac",
  tzolkin: "Mayan Tribe",
  moon: "Moon Phase",
  kin: "Mayan Kin",
  wavespell: "Creation Tone",
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
  skipClaim = false,
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
      rows.push(
        { label: "Tribe", value: `${cycles.galactic.tribe.color} ${cycles.galactic.tribe.name}` },
        { label: "Maya sign", value: cycles.tzolkin.sign },
        { label: "Kin", value: String(cycles.tzolkin.kin) },
        { label: "Tribe codes", value: `${cycles.galactic.tribe.code.power} · ${cycles.galactic.tribe.code.action} · ${cycles.galactic.tribe.code.essence}` },
      );
      break;
    case "wavespell":
      rows.push(
        { label: "Tone", value: `${cycles.galactic.tone.tone} ${cycles.galactic.tone.name}` },
        { label: "Tone codes", value: `${cycles.galactic.tone.code.power} · ${cycles.galactic.tone.code.action} · ${cycles.galactic.tone.code.essence}` },
        { label: "Wavespell", value: String(cycles.mayan.wavespell) },
      );
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
    // Provenance as a sentence, not a badge — precision and kind-of-claim are
    // different things, and the disagreement surface (Task 9) will grow from here.
    // Skipped when the tapped ring already supplies its own claim (avoids a second,
    // possibly conflicting sentence — e.g. Hours-the-convention vs solar-day-the-measurement).
    if (layer.claim && !skipClaim) rows.push({ label: "Claim", value: claimSentence(layer.claim, layer.accuracy, layer.sources) });
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
  ring = null,
  cycles,
  cosmic,
  now,
  onClose,
}: {
  ringId: string;
  /** The tapped wheel ring — carries the claim taxonomy so the sentence reaches visible rings. */
  ring?: ClockRingData | null;
  cycles: CycleSnapshot | null;
  cosmic: CosmicClockState | null;
  now: Date;
  onClose: () => void;
}) {
  const name = RING_NAMES[ringId] ?? ring?.name ?? ringId;
  const detail = ringDetail(ringId, cycles, cosmic, now, Boolean(ring?.claim));
  // Lead with the ring's own claim sentence (Task 7 payload). A bare value row is added only
  // when ringDetail found nothing else, so covered civil/cosmic rings don't get a duplicate.
  const lead: Array<{ label: string; value: string }> = [];
  if (ring && detail.length === 0) {
    lead.push({ label: "Now", value: `${ring.activeSegment.symbol} ${ring.activeSegment.name}`.trim() });
  }
  if (ring?.claim) {
    lead.push({ label: "Claim", value: claimSentence(ring.claim, ring.accuracy, ring.sources) });
  }
  const rows = [...lead, ...detail];

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

/** Default zoom so ms→hour and day/month rings are legible on first open. */
export function defaultClockZoom(outerRadius: number, semicircle = true): number {
  const viewSpan = semicircle ? 200 : 400;
  const target = viewSpan * 0.58;
  const focusRadius = Math.min(outerRadius, 88);
  return Math.max(1.72, Math.min(2.35, target / Math.max(focusRadius, 38)));
}

/**
 * Mobile portrait: compass hub flush at the bottom, outer month ring at the top.
 * Scale the ring stack to fill the semicircle viewport height.
 */
/** Scale ring stack to fill the immersive clock viewport. */
export function fitMobileClockZoom(
  outerRadius: number,
  containerHeightPx = 400,
  containerWidthPx = 400,
): number {
  const viewBoxH = 200;
  const spanY = outerRadius + 16;
  const zoomH = (viewBoxH / spanY) * 1.28;
  const aspect = containerWidthPx / Math.max(1, containerHeightPx);
  const zoomW = aspect > 0.85 ? zoomH * (0.85 + aspect * 0.22) : zoomH;
  return Math.max(1.55, Math.min(5.2, Math.max(zoomH, zoomW)));
}
