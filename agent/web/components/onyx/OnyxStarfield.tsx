"use client";

import { useEffect, useMemo, useState } from "react";

type Comet = {
  id: number;
  top: number;
  left: number;
  angle: number;
  dur: number;
  len: number;
};

/** Shared home-sky dust — same field on every onyx door. Occasional comets keep it alive. */
export function OnyxStarfield({ count = 130 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const top = Math.pow(((i * 17) % 100) / 100, 1.5) * 100;
        const left = (i * 37) % 100;
        const s = i % 8 === 0 ? 1.2 + (i % 3) * 0.4 : 0.4 + (i % 5) * 0.15;
        const o = 0.22 + (i % 6) * 0.08;
        const shimmer = i % 5 === 0;
        return {
          top,
          left,
          s,
          o,
          tw: shimmer ? 7 + (i % 6) : 3 + (i % 5),
          d: (i % 11) * 0.85,
          shimmer,
          key: i,
        };
      }),
    [count],
  );

  const [comets, setComets] = useState<Comet[]>([]);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let nextId = 1;

    const spawn = () => {
      if (!alive || document.visibilityState === "hidden") {
        schedule();
        return;
      }
      const angle = -28 - Math.random() * 34; // down-right streaks
      const fromLeft = Math.random() > 0.35;
      const comet: Comet = {
        id: nextId++,
        top: 4 + Math.random() * 48,
        left: fromLeft ? -8 + Math.random() * 40 : 55 + Math.random() * 40,
        angle,
        dur: 0.85 + Math.random() * 1.1,
        len: 70 + Math.random() * 90,
      };
      setComets(prev => [...prev.slice(-2), comet]);
      window.setTimeout(() => {
        if (!alive) return;
        setComets(prev => prev.filter(c => c.id !== comet.id));
      }, comet.dur * 1000 + 80);
      schedule();
    };

    const schedule = () => {
      // Sparse — sudden, not a meteor shower.
      const wait = 7000 + Math.random() * 16000;
      timer = window.setTimeout(spawn, wait);
    };

    // First comet after the street has settled a bit.
    timer = window.setTimeout(spawn, 4500 + Math.random() * 4000);

    const onVis = () => {
      if (document.visibilityState === "visible" && !timer) schedule();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="onyx-stars" aria-hidden>
      {stars.map(s => (
        <span
          key={s.key}
          className={`onyx-dust${s.shimmer ? " shimmer" : ""}`}
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.s,
            height: s.s,
            ["--o" as string]: s.o,
            ["--tw" as string]: `${s.tw}s`,
            ["--d" as string]: `${s.d}s`,
          }}
        />
      ))}
      {comets.map(c => (
        <span
          key={c.id}
          className="onyx-comet"
          style={{
            top: `${c.top}%`,
            left: `${c.left}%`,
            width: c.len,
            ["--comet-angle" as string]: `${c.angle}deg`,
            ["--comet-dur" as string]: `${c.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
