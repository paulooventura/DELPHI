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
    <svg className="onyx-gem-svg" width="28" height="32" viewBox="0 0 28 32" aria-hidden>
      <polygon
        points="14,2 26,10 26,22 14,30 2,22 2,10"
        fill={fill}
        stroke="rgba(233,214,168,0.55)"
        strokeWidth="1"
      />
      <polygon
        points="14,6 22,11 22,19 14,24 6,19 6,11"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.7"
      />
      <circle cx="14" cy="14" r="2.2" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}
