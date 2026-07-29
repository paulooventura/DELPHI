"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  castIChingMode,
  castOrishaMode,
  castRuneSpread,
  castTarotSpread,
  CAST_FRAMING,
  CAST_RITUAL_VIDEO,
  ICHING_MODES,
  ORISHA_MODES,
  RUNE_SPREADS,
  TAROT_SPREADS,
  type CastResult,
  type IChingModeId,
  type OrishaModeId,
  type RuneSpreadId,
  type TarotSpreadId,
} from "../../lib/lore/cast";
import { embraceCast, type EmbracedCast } from "../../lib/lore/castStore";
import { CAST_SYSTEMS } from "../../lib/lore/qualia";
import { CastCard } from "./CastCard";
import { CastGems, type CastGemChoice } from "./CastGems";

const RITUAL_FADE_MS = 480;

type Picker = "tarot" | "orisha" | "iching" | "rune" | null;

/**
 * Side-door divination — tradition-faithful modes, honest framing.
 * Never wired into the home chord. Gemstones: embrace / change / reject.
 */
export function OnyxCast({
  onBack,
  onEmbraced,
}: {
  onBack: () => void;
  onEmbraced?: (list: EmbracedCast[]) => void;
}) {
  const [result, setResult] = useState<CastResult | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [ritual, setRitual] = useState<{
    system: string;
    src: string;
    pending: CastResult;
  } | null>(null);
  const [ritualVeil, setRitualVeil] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const pendingRef = useRef<CastResult | null>(null);

  function revealCast() {
    if (finished.current || !pendingRef.current) return;
    finished.current = true;
    const pending = pendingRef.current;
    setRitualVeil(true);
    window.setTimeout(() => {
      setResult(pending);
      setRitual(null);
      setRitualVeil(false);
      pendingRef.current = null;
    }, RITUAL_FADE_MS);
  }

  function runRitual(pending: CastResult) {
    const src =
      CAST_RITUAL_VIDEO[pending.system] ??
      CAST_RITUAL_VIDEO[
        pending.system.startsWith("orisha")
          ? "orisha-cast"
          : pending.system.startsWith("iching")
            ? "iching-hexagram"
            : pending.system.startsWith("tarot")
              ? "tarot"
              : pending.system
      ];
    finished.current = false;
    pendingRef.current = pending;
    setResult(null);
    setPicker(null);
    if (!src) {
      setResult(pending);
      pendingRef.current = null;
      return;
    }
    setRitual({ system: pending.system, src, pending });
    setRitualVeil(false);
  }

  function openTradition(system: string) {
    setResult(null);
    if (system === "tarot" || system === "tarot-major") setPicker("tarot");
    else if (system.startsWith("orisha")) setPicker("orisha");
    else if (system.startsWith("iching")) setPicker("iching");
    else if (system === "rune-cast") setPicker("rune");
  }

  useEffect(() => {
    if (!ritual) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    void v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => revealCast());
    });
    const safety = window.setTimeout(() => revealCast(), 28000);
    return () => window.clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ritual?.src]);

  if (ritual) {
    const framing =
      CAST_FRAMING[ritual.system] ??
      CAST_FRAMING[
        ritual.system.startsWith("orisha")
          ? "orisha-cast"
          : ritual.system.startsWith("iching")
            ? "iching-hexagram"
            : ritual.system.startsWith("tarot")
              ? "tarot"
              : ritual.system
      ];
    const label =
      ritual.pending.spreadLabel != null
        ? `${framing?.label ?? "Cast"} · ${ritual.pending.spreadLabel}`
        : framing?.label ?? "Cast";
    return (
      <div className="onyx-root">
        <div className="onyx-device onyx-cast-ritual" onClick={revealCast}>
          <button
            type="button"
            className="onyx-overlay-close"
            onClick={e => {
              e.stopPropagation();
              onBack();
            }}
          >
            close
          </button>
          <div className="onyx-cast-film">
            <video
              ref={videoRef}
              key={ritual.src}
              playsInline
              preload="auto"
              onEnded={revealCast}
            >
              <source src={ritual.src} type="video/mp4" />
            </video>
          </div>
          <div className="onyx-cast-ritual-grade" aria-hidden />
          <p className="onyx-cast-ritual-label">{label}</p>
          <p className="onyx-cast-ritual-hint">tap to reveal</p>
          <div className={`onyx-splash-veil${ritualVeil ? " on" : ""}`} aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="onyx-root">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-overlay">
          <p className="onyx-eyebrow">CAST</p>
          <p className="onyx-layer-lead">
            Choose a tradition rooted in its own method — crypto-random, never the sky clock. Off by
            default.
          </p>

          <div className="onyx-tools-grid">
            {CAST_SYSTEMS.map(system => {
              const framing = CAST_FRAMING[system];
              const pickerFor =
                system === "tarot"
                  ? "tarot"
                  : system === "orisha-cast"
                    ? "orisha"
                    : system === "iching-hexagram"
                      ? "iching"
                      : system === "rune-cast"
                        ? "rune"
                        : null;
              const active = picker === pickerFor || result?.framing.label === framing?.label;
              const subtitle =
                system === "tarot"
                  ? "One · three · Celtic Cross · reversals"
                  : system === "orisha-cast"
                    ? "Sixteen cowries · Orisha names"
                    : system === "iching-hexagram"
                      ? "Three-coin hexagram · changing lines"
                      : "One rune · Norns three";
              return (
                <button
                  key={system}
                  type="button"
                  className={`onyx-tool-btn${active ? " on" : ""}`}
                  onClick={() => openTradition(system)}
                >
                  {framing?.label ?? system}
                  <span>{subtitle}</span>
                </button>
              );
            })}
          </div>

          {picker === "tarot" && (
            <ModePicker
              title="TAROT SPREAD"
              hint="Full Rider-Waite-Smith. Each card may fall upright or reversed."
              onBack={() => setPicker(null)}
            >
              {TAROT_SPREADS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="onyx-tool-btn"
                  onClick={() => runRitual(castTarotSpread(s.id as TarotSpreadId))}
                >
                  {s.label}
                  <span>{s.blurb}</span>
                </button>
              ))}
            </ModePicker>
          )}

          {picker === "orisha" && (
            <ModePicker
              title="ORISHA METHOD"
              hint="Diloggun counts mouths. Names are a separate reflective draw — never a babalawo reading."
              onBack={() => setPicker(null)}
            >
              {ORISHA_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className="onyx-tool-btn"
                  onClick={() => runRitual(castOrishaMode(m.id as OrishaModeId))}
                >
                  {m.label}
                  <span>{m.blurb}</span>
                </button>
              ))}
            </ModePicker>
          )}

          {picker === "iching" && (
            <ModePicker
              title="I CHING METHOD"
              hint="Coins build six lines bottom-to-top. Changing lines open a relating hexagram."
              onBack={() => setPicker(null)}
            >
              {ICHING_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className="onyx-tool-btn"
                  onClick={() => runRitual(castIChingMode(m.id as IChingModeId))}
                >
                  {m.label}
                  <span>{m.blurb}</span>
                </button>
              ))}
            </ModePicker>
          )}

          {picker === "rune" && (
            <ModePicker
              title="RUNE CAST"
              hint="Elder Futhark — twenty-four staves. No blank rune."
              onBack={() => setPicker(null)}
            >
              {RUNE_SPREADS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="onyx-tool-btn"
                  onClick={() => runRitual(castRuneSpread(s.id as RuneSpreadId))}
                >
                  {s.label}
                  <span>{s.blurb}</span>
                </button>
              ))}
            </ModePicker>
          )}

          {result && (
            <div className="onyx-cast-result">
              <p className="onyx-eyebrow">
                {result.framing.label}
                {result.spreadLabel ? ` · ${result.spreadLabel}` : ""}
              </p>
              <p className="onyx-cast-frame">{result.framing.frame}</p>

              {result.cowrieUp != null && (
                <p className="onyx-layer-meta">
                  Shells mouth-up · {result.cowrieUp} of 16
                </p>
              )}
              {result.changingLines && result.changingLines.length > 0 && (
                <p className="onyx-layer-meta">
                  Changing lines · {result.changingLines.join(", ")} (bottom = 1)
                </p>
              )}
              {result.ichingLines && (
                <p className="onyx-layer-meta">
                  Line values · {result.ichingLines.join(" · ")} (6/7/8/9)
                </p>
              )}

              <div
                className={
                  result.drawn.length > 1 ? "onyx-cast-spread-grid" : "onyx-cast-drawing"
                }
              >
                {result.drawn.map((entry, i) => {
                  const position = result.positions?.[i];
                  const reversed = result.cards?.[i]?.reversed === true;
                  return (
                    <div key={`${entry.id}-${i}`} className="onyx-cast-spread-slot">
                      {position && (
                        <p className="onyx-cast-position">
                          {result.drawn.length > 1 ? `${i + 1}. ` : ""}
                          {position}
                        </p>
                      )}
                      <CastCard
                        entry={entry}
                        system={result.system}
                        frame={position ?? result.framing.frame}
                        reversed={reversed}
                      />
                    </div>
                  );
                })}
              </div>

              <p className="onyx-layer-meta">{result.framing.note}</p>

              <CastGems
                onChoose={(choice: CastGemChoice) => {
                  if (choice === "embrace") {
                    const qualities = [
                      ...new Set(
                        result.drawn.flatMap(d => d.qualities.map(q => q.toLowerCase())),
                      ),
                    ];
                    const list = embraceCast({
                      system: result.system,
                      label: result.framing.label,
                      names: result.drawn.map(d => d.name),
                      entryIds: result.drawn.map(d => d.id),
                      qualities,
                      spreadLabel: result.spreadLabel,
                    });
                    // Parent retunes the home moment and returns — do not double-navigate.
                    if (onEmbraced) onEmbraced(list);
                    else onBack();
                    return;
                  }
                  if (choice === "reject") {
                    setResult(null);
                    return;
                  }
                  // Yellow — change: same mode again.
                  const sid = result.spreadId;
                  if (result.framing.label === "Tarot" && sid)
                    runRitual(castTarotSpread(sid as TarotSpreadId));
                  else if (result.framing.label === "Orisha" && sid)
                    runRitual(castOrishaMode(sid as OrishaModeId));
                  else if (result.framing.label === "I Ching" && sid)
                    runRitual(castIChingMode(sid as IChingModeId));
                  else if (result.framing.label === "Runes" && sid)
                    runRitual(castRuneSpread(sid as RuneSpreadId));
                  else
                    openTradition(result.system);
                }}
              />
              <p className="onyx-cast-gem-hint">
                Green holds it in the moment · yellow draws again · red lets it go
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModePicker({
  title,
  hint,
  onBack,
  children,
}: {
  title: string;
  hint: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="onyx-cast-spreads">
      <p className="onyx-eyebrow">{title}</p>
      <p className="onyx-layer-meta">{hint}</p>
      <div className="onyx-tools-grid">{children}</div>
      <button type="button" className="onyx-ghost-btn" style={{ marginTop: 10 }} onClick={onBack}>
        Back
      </button>
    </div>
  );
}
