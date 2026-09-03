"use client";

import { useMemo } from "react";

/** Shared home-sky dust — same field on every onyx door. */
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
    </div>
  );
}
