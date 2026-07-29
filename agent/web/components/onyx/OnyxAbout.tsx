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
              Tarot (majors, upright/reversed spreads), Orisha (mérìndílógún cowrie count — not a
              babalawo Ifá reading), I Ching (three-coin hexagrams with changing lines), and Elder
              Futhark rune casts are genuine cryptographic-random draws. Nothing here predicts the
              future — it is offered as a mirror for reflection.
            </p>
            <p style={{ marginTop: 12 }}>
              The home sentence names the standing wave across the whole chorus — the single
              emergent character — not Leo, Horse, or any other source. Tap “see why” to open the
              provenance.
            </p>
          </div>

          <p className="onyx-eyebrow">LEGITIMACY — MEASURED VS CELEBRATED</p>
          <ul className="onyx-about-list">
            <li>
              <b>Measured</b> — real astronomy and math Delphi stakes precision on (moon phase,
              nakshatra position, and kin). Shown at the point of reading.
            </li>
            <li>
              <b>Celebrated</b> — how cultures have read the sky, offered with respect — not official
              representation of any nation or priesthood.
            </li>
          </ul>

          <p className="onyx-eyebrow">HONESTY TIERS</p>
          <ul className="onyx-about-list">
            <li>
              <b>Computed</b> — sky and calendar math on Layer 0 (“The moment”). Locked when you
              arrive home; same for anyone at that place and instant.
            </li>
            <li>
              <b>Through you</b> — birth data you save folds into a labeled layer. One tap returns
              to the pure moment.
            </li>
            <li>
              <b>Drawn</b> — casts you embrace colour a labeled layer. Never automatic onto Layer 0.
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
