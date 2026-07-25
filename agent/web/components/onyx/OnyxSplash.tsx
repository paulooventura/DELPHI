"use client";

import { useMemo } from "react";

function fmtCoord(lat: number, lon: number): { n: string; w: string } {
  const n = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const w = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  return { n, w };
}

export function OnyxSplash({
  now,
  lat,
  lon,
  altM,
  onEnter,
}: {
  now: Date;
  lat: number;
  lon: number;
  altM?: number | null;
  onEnter: () => void;
}) {
  const { n, w } = fmtCoord(lat, lon);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tz = now.toLocaleTimeString([], { timeZoneName: "short" }).split(" ").pop() ?? "";
  const seeds = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const top = Math.pow((i * 0.37) % 1, 1.5) * 70;
        const left = ((i * 47) % 100);
        const s = i % 5 === 0 ? 1.4 + (i % 3) * 0.3 : 0.5 + (i % 4) * 0.2;
        const o = 0.3 + (i % 5) * 0.08;
        const sd = 2 + (i % 6) * 0.4;
        const tw = 3 + (i % 5);
        return { top, left, s, o, sd, tw, key: i };
      }),
    [],
  );

  return (
    <div className="onyx-root" role="dialog" aria-label="Delphi splash">
      <div className="onyx-device">
        <div className="onyx-film">
          <video autoPlay muted loop playsInline poster="/delphi-brand-reference.png">
            <source src="/delphi-intro.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="onyx-grade" />
        <div className="onyx-tint" />
        <div className="onyx-dimmer" />

        {seeds.map(s => (
          <span
            key={s.key}
            className="onyx-seed"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.s,
              height: s.s,
              ["--o" as string]: s.o,
              ["--sd" as string]: `${s.sd}s`,
              ["--tw" as string]: `${s.tw}s`,
            }}
          />
        ))}

        <div className="onyx-splash-wordmark">
          <div className="name">DELPHI</div>
          <div className="tag">WORLD CYCLES · PRECISE TO THE ARCMINUTE</div>
        </div>
        <div className="onyx-horizon" />

        <span className="onyx-fix tl">{n}</span>
        <span className="onyx-fix tr">{w}</span>
        <span className="onyx-fix bl">
          ALT {altM != null && Number.isFinite(altM) ? `${Math.round(altM)}M` : "—"}
        </span>
        <span className="onyx-fix br">
          {time} {tz}
        </span>

        <div className="onyx-enter">
          <button type="button" onClick={onEnter}>
            tune in ↗
          </button>
          <span className="pulse">or hold still, and look up</span>
        </div>
      </div>
    </div>
  );
}
