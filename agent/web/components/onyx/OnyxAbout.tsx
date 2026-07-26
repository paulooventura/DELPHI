"use client";

export function OnyxAbout({ onBack }: { onBack: () => void }) {
  return (
    <div className="onyx-root">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-overlay">
          <p className="onyx-eyebrow">ABOUT</p>
          <p className="onyx-layer-lead">Integrity of the reading</p>

          <div className="onyx-about-block">
            <p>
              Calendar readings are computed from real astronomical positions to the arcminute.
              Tarot, Orisha, I Ching, and rune draws are genuine cryptographic-random casts. Nothing
              here predicts the future — it is offered as a mirror for reflection.
            </p>
          </div>

          <p className="onyx-eyebrow">HONESTY TIERS</p>
          <ul className="onyx-about-list">
            <li>
              <b>Computed</b> — sky and calendar math on the home chord. Provenance intact.
            </li>
            <li>
              <b>Drawn</b> — side-door casts you choose. Never automatic, never on home.
            </li>
            <li>
              <b>Acknowledged</b> — land heritage and sacred calendars shown with respect; they do
              not score the personality chord.
            </li>
          </ul>

          <p className="onyx-eyebrow">YOUR BIRTH DATA</p>
          <p className="onyx-layer-meta">
            If you enter a birth date under YOU, it is stored only in this browser&apos;s
            localStorage. It is never transmitted to a server, never included in phrase requests,
            and never used for analytics.
          </p>
        </div>
      </div>
    </div>
  );
}
