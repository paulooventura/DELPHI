"use client";

import { giveAiConsent, RESEARCH_AI_PROVIDERS } from "../lib/aiConsent";

/** Asked once, before the first Research question leaves the device. Nothing is sent until "Send". */
export function AiConsentSheet({ onAllow, onCancel }: { onAllow: () => void; onCancel: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "end center",
        background: "rgba(0,0,0,0.6)",
        padding: "1rem 1rem calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: "#0d0b16",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: "1.25rem",
          color: "#cfcbe0",
          fontSize: "0.92rem",
          lineHeight: 1.55,
        }}
      >
        <h2 id="ai-consent-title" style={{ margin: 0, fontSize: "1.05rem", color: "#f4f1ff", fontWeight: 500 }}>
          Send your question to AI providers?
        </h2>
        <p>
          To find and weigh sources, the question you type is sent through our server to these AI and search
          services: {RESEARCH_AI_PROVIDERS.join(", ")}. They answer it under their own terms. Nothing else goes with it:
          no birth data, no location, no account.
        </p>
        <p style={{ fontSize: "0.8rem" }}>
          We ask once on this device. <a href="/privacy">Privacy</a>
        </p>
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button type="button" onClick={onCancel} style={btn(false)}>
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              giveAiConsent();
              onAllow();
            }}
            style={btn(true)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function btn(primary: boolean) {
  return {
    padding: "0.55rem 1rem",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: primary ? "#f4f1ff" : "transparent",
    color: primary ? "#0d0b16" : "#f4f1ff",
    fontSize: "0.9rem",
    cursor: "pointer",
  } as const;
}
