"use client";

export type AppTab = "clock" | "sky" | "senses" | "oracle";

const TABS: { id: AppTab; label: string; glyph: string; hint: string }[] = [
  { id: "clock",  label: "Clock",  glyph: "◴", hint: "Cosmic clock wheels" },
  { id: "sky",    label: "Sky",    glyph: "✦", hint: "Live sky map & compass" },
  { id: "senses", label: "Senses", glyph: "◉", hint: "Device sensor array" },
  { id: "oracle", label: "Oracle", glyph: "❖", hint: "Research console" },
];

export function BottomNav({
  tab,
  onChange,
}: {
  tab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="cp-tabbar" role="tablist" aria-label="DELPHI sections">
      {TABS.map(t => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            aria-label={t.hint}
            className={`cp-tabbar-item${active ? " cp-tabbar-item-active" : ""}`}
            onClick={() => {
              if (!active) {
                onChange(t.id);
                try { navigator.vibrate?.(8); } catch { /* no haptics */ }
              }
            }}
          >
            <span className="cp-tabbar-glyph" aria-hidden>{t.glyph}</span>
            <span className="cp-tabbar-label">{t.label}</span>
            <span className="cp-tabbar-dot" aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
