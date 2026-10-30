"use client";

import { useEffect, useState } from "react";
import type { HowToRead } from "../../lib/lore/readingGuide";
import "./castGuide.css";

/** Set after the first reading; later readings open with the steps folded. */
export const CAST_GUIDE_SEEN_KEY = "pm-cast-guide-seen";

function seenBefore(): boolean {
  try {
    return localStorage.getItem(CAST_GUIDE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** "How to read this": open on the first-ever reading, folded after. */
export function CastHowToRead({ guide }: { guide: HowToRead }) {
  const [open, setOpen] = useState(() => !seenBefore());

  useEffect(() => {
    try {
      localStorage.setItem(CAST_GUIDE_SEEN_KEY, "1");
    } catch {
      /* private mode: it simply opens again next time */
    }
  }, []);

  return (
    <details
      className="onyx-cast-howto"
      open={open}
      onToggle={e => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span className="onyx-cast-howto-label">How to read this</span>
        <span className="onyx-cast-howto-title">{guide.title}</span>
      </summary>
      <ol>
        {guide.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}
