"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeCelestialBodies } from "../../lib/cosmic/celestialBodies";
import { BRIGHT_STARS, STAR_TO_CONSTELLATION, type StarData } from "../../lib/starmap";
import { raDecToAltAz } from "../../lib/skyPositions";
import { cardinalFromHeading } from "./onyxCopy";

type SkyKind = "star" | "planet" | "moving";
type SkyObj = {
  id: string;
  name: string;
  kind: SkyKind;
  alt: number;
  az: number;
  mag: string;
  where: string;
  bright?: boolean;
  x: number;
  y: number;
  size: number;
};

const TAG: Record<SkyKind, string> = {
  star: "FIXED STAR",
  planet: "IN THE SOLAR SYSTEM",
  moving: "IN MOTION",
};

const PROV: Record<SkyKind, (o: SkyObj) => string> = {
  star: o =>
    `<b>Position measured to the arcminute.</b> A fixed star — the light you see left it ${o.where.split("·").pop()?.trim() || "ages"} ago.`,
  planet: () =>
    `<b>Position measured to the arcminute.</b> Ephemeris-computed — where it truly is in the sky right now.`,
  moving: () =>
    `<b>Live track, updated each second.</b> Not a star — it's moving. Position from a real-time feed.`,
};

const DIRS = ["N", "·", "NE", "·", "E", "·", "SE", "·", "S", "·", "SW", "·", "W", "·", "NW", "·", "N", "·", "NE", "·", "E"];

function project(
  az: number,
  alt: number,
  heading: number,
  pitch: number,
  W: number,
  H: number,
): { x: number; y: number; on: boolean } {
  let daz = ((az - heading + 540) % 360) - 180;
  const dalt = alt - pitch;
  const x = W / 2 + (daz / 48) * (W / 2);
  const y = H * 0.42 - (dalt / 42) * (H * 0.38);
  const on = Math.abs(daz) < 72 && Math.abs(dalt) < 55 && alt > -8;
  return { x, y, on };
}

function starWhere(s: StarData & { distanceLy?: number }): string {
  const ly = s.distanceLy != null ? `${Math.round(s.distanceLy).toLocaleString()} ly` : "distant";
  const con = STAR_TO_CONSTELLATION[s.name] ?? s.bayer ?? "sky";
  return `${con} · ${ly}`;
}

export function OnyxSky({
  now,
  lat,
  lon,
  altM,
  headingDeg,
  pitchDeg,
  onBack,
  onTellMore,
}: {
  now: Date;
  lat: number;
  lon: number;
  altM: number;
  headingDeg: number;
  pitchDeg: number;
  onBack: () => void;
  onTellMore?: (name: string) => void;
}) {
  const deviceRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 390, H: 780 });
  const [filter, setFilter] = useState<"all" | SkyKind>("all");
  const [aim, setAim] = useState({ x: 195, y: 328 });
  const [selected, setSelected] = useState<SkyObj | null>(null);
  const [litId, setLitId] = useState<string | null>(null);

  useEffect(() => {
    const el = deviceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ W: el.clientWidth, H: el.clientHeight });
    });
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    setAim({ x: el.clientWidth / 2, y: el.clientHeight * 0.42 });
    return () => ro.disconnect();
  }, []);

  const dust = useMemo(
    () =>
      Array.from({ length: 150 }, (_, i) => {
        const top = Math.pow(((i * 19) % 100) / 100, 1.4) * 100;
        const left = (i * 41) % 100;
        const s = i % 10 === 0 ? 1.2 + (i % 3) * 0.3 : 0.35 + (i % 5) * 0.12;
        return { top, left, s, o: 0.22 + (i % 6) * 0.07, tw: 3 + (i % 5), d: (i % 5) * 0.8, key: i };
      }),
    [],
  );

  const objects = useMemo(() => {
    const { W, H } = size;
    const bodies = computeCelestialBodies(now, lat, lon, altM);
    const out: SkyObj[] = [];

    for (const b of bodies) {
      if (b.id === "sun") continue;
      const p = project(b.az, b.alt, headingDeg, pitchDeg, W, H);
      if (!p.on) continue;
      out.push({
        id: b.id,
        name: b.name,
        kind: "planet",
        alt: b.alt,
        az: b.az,
        mag: `mag ${b.magnitude.toFixed(1)}`,
        where: `${Math.round(b.alt)}° above horizon`,
        bright: b.magnitude < 1.5,
        x: p.x,
        y: p.y,
        size: b.id === "moon" ? 5 : 4,
      });
    }

    const stars = (BRIGHT_STARS as Array<StarData & { distanceLy?: number }>)
      .filter(s => s.mag <= 2.5)
      .slice(0, 36);
    for (const s of stars) {
      const pos = raDecToAltAz(now, lat, lon, s.ra, s.dec, altM);
      const p = project(pos.az, pos.alt, headingDeg, pitchDeg, W, H);
      if (!p.on) continue;
      out.push({
        id: `star-${s.name}`,
        name: s.name,
        kind: "star",
        alt: pos.alt,
        az: pos.az,
        mag: `mag ${s.mag.toFixed(2)}`,
        where: starWhere(s),
        bright: s.mag < 0.5,
        x: p.x,
        y: p.y,
        size: s.mag < 0.5 ? 3 : 2,
      });
    }

    return out;
  }, [now, lat, lon, altM, headingDeg, pitchDeg, size]);

  const visible = objects.filter(o => filter === "all" || o.kind === filter);

  useEffect(() => {
    let best: SkyObj | null = null;
    let bd = 1e9;
    for (const o of visible) {
      const d = Math.hypot(o.x - aim.x, o.y - aim.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    setLitId(best && bd < 130 ? best.id : null);
  }, [aim, visible]);

  const card = ["N", "E", "S", "W", "NE", "SE", "SW", "NW"];
  const ribbonX = -((headingDeg % 360) / 360) * (DIRS.length * 44) + size.W / 2 - 22;
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const look = cardinalFromHeading(headingDeg);

  const openSheet = (o: SkyObj) => setSelected(o);
  const lit = visible.find(o => o.id === litId) ?? null;

  return (
    <div className="onyx-root">
      <div className="onyx-device onyx-sky-device" ref={deviceRef} role="application" aria-label="Delphi sky view">
        <button type="button" className="onyx-sky-back" onClick={onBack}>
          ← home
        </button>

        <div
          className="onyx-sky"
          onMouseMove={e => {
            const r = deviceRef.current?.getBoundingClientRect();
            if (!r) return;
            setAim({ x: e.clientX - r.left, y: e.clientY - r.top });
          }}
          onTouchMove={e => {
            const r = deviceRef.current?.getBoundingClientRect();
            const t = e.touches[0];
            if (!r || !t) return;
            setAim({ x: t.clientX - r.left, y: t.clientY - r.top });
          }}
        >
          {dust.map(d => (
            <span
              key={d.key}
              className="onyx-dust"
              style={{
                top: `${d.top}%`,
                left: `${d.left}%`,
                width: d.s,
                height: d.s,
                ["--o" as string]: d.o,
                ["--tw" as string]: `${d.tw}s`,
                ["--d" as string]: `${d.d}s`,
              }}
            />
          ))}

          {visible.map(o => (
            <button
              key={o.id}
              type="button"
              className={`onyx-obj ${o.kind}${o.bright ? " bright" : ""}${o.id === litId ? " lit" : ""}`}
              style={{
                left: o.x,
                top: o.y,
                ["--br" as string]: "5s",
                ["--bd" as string]: "0s",
              }}
              onClick={e => {
                e.stopPropagation();
                openSheet(o);
              }}
            >
              <span className="halo" />
              {o.kind === "moving" && <span className="trail" />}
              <span className="dot" style={{ width: o.size, height: o.size }} />
              <svg className="ring" width="52" height="52" viewBox="0 0 52 52">
                <polygon
                  points="26,4 44,15 44,37 26,48 8,37 8,15"
                  fill="none"
                  stroke="var(--onyx-edge-bright)"
                  strokeWidth="0.75"
                />
                <circle cx="26" cy="26" r="11" fill="none" stroke="var(--onyx-light)" strokeWidth="0.4" strokeOpacity={0.6} />
              </svg>
              <div className="label">
                <div className="nm">{o.name}</div>
                <div className="dt">{o.mag}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="onyx-reticle">
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="20" fill="none" stroke="var(--onyx-edge)" strokeWidth="0.5" />
            <line x1="23" y1="4" x2="23" y2="12" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
            <line x1="23" y1="34" x2="23" y2="42" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
            <line x1="4" y1="23" x2="12" y2="23" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
            <line x1="34" y1="23" x2="42" y2="23" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
          </svg>
        </div>

        <div className="onyx-sky-top">
          <span className="onyx-wordmark">DELPHI</span>
        </div>
        <div className="onyx-sky-coords">
          <span>
            {Math.abs(lat).toFixed(2)}°{lat >= 0 ? "N" : "S"} · looking {look}
          </span>
          <span>{time}</span>
        </div>

        <div className="onyx-heading-mark">
          <svg width="12" height="8">
            <path d="M6 8 L0 0 L12 0 Z" fill="var(--onyx-core)" />
          </svg>
        </div>
        <div className="onyx-heading">
          <div className="onyx-ribbon" style={{ transform: `translateX(${ribbonX}px)` }}>
            {DIRS.map((d, i) => (
              <span key={`${d}-${i}`} className={`onyx-tick${card.includes(d) ? " card" : ""}`}>
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="onyx-filters">
          {(
            [
              ["all", "everything"],
              ["planet", "planets"],
              ["star", "stars"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className={`onyx-filt${filter === f ? " on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="onyx-sky-hint">
          {lit ? `${lit.name} · tap for details` : "tap any object · aim to resolve"}
        </p>

        <div className={`onyx-sheet${selected ? " up" : ""}`} id="sheet">
          <button type="button" className="close" aria-label="Close" onClick={() => setSelected(null)}>
            ✕
          </button>
          {selected && (
            <>
              <p className="stag">{TAG[selected.kind]}</p>
              <p className="sname">{selected.name}</p>
              <div className="srow">
                <span className="sk">brightness</span>
                <span className="sv">{selected.mag}</span>
              </div>
              <div className="srow">
                <span className="sk">where</span>
                <span className="sv">{selected.where}</span>
              </div>
              <div className="srow">
                <span className="sk">altitude</span>
                <span className="sv">{Math.round(selected.alt)}°</span>
              </div>
              <div className="srow">
                <span className="sk">azimuth</span>
                <span className="sv">{Math.round(selected.az)}°</span>
              </div>
              <div className="srow">
                <span className="sk">kind</span>
                <span className="sv">{selected.kind === "moving" ? "in motion" : selected.kind}</span>
              </div>
              <p className="prov" dangerouslySetInnerHTML={{ __html: PROV[selected.kind](selected) }} />
              <button
                type="button"
                className="more"
                onClick={() => onTellMore?.(selected.name)}
              >
                tell me more ↗
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
