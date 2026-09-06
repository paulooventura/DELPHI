"use client";

export type CastGemChoice = "embrace" | "change" | "reject";

/** Green = hold it · Yellow = draw again · Red = let it go. */
export function CastGems({
  onChoose,
  disabled,
}: {
  onChoose: (choice: CastGemChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className="onyx-cast-gems" role="group" aria-label="Respond to this cast">
      <button
        type="button"
        className="onyx-gem onyx-gem-green"
        disabled={disabled}
        onClick={() => onChoose("embrace")}
        aria-label="Embrace — hold this cast"
      >
        <GemSvg fill="var(--onyx-gem-green)" />
        <span>Embrace</span>
      </button>
      <button
        type="button"
        className="onyx-gem onyx-gem-yellow"
        disabled={disabled}
        onClick={() => onChoose("change")}
        aria-label="Change — draw again"
      >
        <GemSvg fill="var(--onyx-gem-yellow)" />
        <span>Change</span>
      </button>
      <button
        type="button"
        className="onyx-gem onyx-gem-red"
        disabled={disabled}
        onClick={() => onChoose("reject")}
        aria-label="Reject — discard this cast"
      >
        <GemSvg fill="var(--onyx-gem-red)" />
        <span>Reject</span>
      </button>
    </div>
  );
}

function GemSvg({ fill }: { fill: string }) {
  return (
    <svg className="onyx-gem-svg" width="36" height="22" viewBox="0 0 36 22" aria-hidden>
      <polygon
        points="5,1 31,1 35,6 35,16 31,21 5,21 1,16 1,6"
        fill={fill}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.7"
      />
      <polygon
        points="8,4 28,4 31,7 31,15 28,18 8,18 5,15 5,7"
        fill="none"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="0.55"
      />
      <polygon
        points="11,7 25,7 27,9 27,13 25,15 11,15 9,13 9,9"
        fill="rgba(255,255,255,0.16)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.4"
      />
      <path d="M5 1 L12 7" stroke="rgba(255,255,255,0.5)" strokeWidth="0.45" />
      <path d="M31 1 L24 7" stroke="rgba(255,255,255,0.28)" strokeWidth="0.45" />
    </svg>
  );
}
