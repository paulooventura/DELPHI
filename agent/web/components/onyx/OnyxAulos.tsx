"use client";

/**
 * Homescreen Aulos of Delphi — tap to play the hymn and reveal lyrics.
 * Ducks the Omphalos symphony bed while the vocal lead is on.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AULOS_SECTIONS, AULOS_TITLE } from "../../lib/aulosLyrics";
import { setSymphonyDucked } from "../../lib/symphonyDuck";
import { pulseHaptic } from "../../lib/haptics";
import { DELPHI_BUILD } from "../../lib/buildStamp";

export const AULOS_SRC = "/aulos-of-delphi.m4a";

const AULOS_VOLUME = 0.92;

export function OnyxAulos({
  soundAllowed = true,
  visible = true,
}: {
  /** Master stone — when quiet, pause the hymn. */
  soundAllowed?: boolean;
  /** Street depth only — hide on deeper home layers. */
  visible?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const a = new Audio(`${AULOS_SRC}?v=${DELPHI_BUILD}`);
    a.preload = "metadata";
    a.volume = AULOS_VOLUME;
    audioRef.current = a;

    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
      setSymphonyDucked(true);
    };
    const onPause = () => {
      setPlaying(false);
      setSymphonyDucked(false);
    };
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      setSymphonyDucked(false);
    };

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.pause();
      a.src = "";
      audioRef.current = null;
      setSymphonyDucked(false);
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!soundAllowed && !a.paused) {
      a.pause();
    }
  }, [soundAllowed]);

  const closeLyrics = useCallback(() => {
    setLyricsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    void pulseHaptic("tick");

    if (!soundAllowed) {
      setLyricsOpen(true);
      return;
    }

    if (a.paused) {
      if (ended) {
        a.currentTime = 0;
        setEnded(false);
      }
      void a.play().catch(() => {});
      setLyricsOpen(true);
      return;
    }

    // Already playing — keep audio, (re)open lyrics if closed; else pause.
    if (!lyricsOpen) {
      setLyricsOpen(true);
      return;
    }
    a.pause();
  }, [ended, lyricsOpen, soundAllowed]);

  useEffect(() => {
    if (!lyricsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLyrics();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lyricsOpen, closeLyrics]);

  if (!visible && !lyricsOpen) return null;

  return (
    <>
      {visible && (
        <button
          type="button"
          className={`onyx-aulos-btn${playing ? " on" : ""}`}
          aria-pressed={playing}
          aria-label={
            playing
              ? "Aulos of Delphi playing — open lyrics or pause"
              : "Play Aulos of Delphi and show lyrics"
          }
          onClick={e => {
            e.stopPropagation();
            toggle();
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          <span className="onyx-aulos-reed" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M4.2 12.2V3.4c0-.7.4-1.3 1-1.6l.6-.3.6.3c.6.3 1 1 1 1.6v8.8"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <path
                d="M7.2 12.2V4.1c0-.55.3-1 .8-1.25L8.5 2.6l.5.25c.5.25.8.7.8 1.25v8.1"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                opacity="0.75"
              />
              <circle cx="5.8" cy="5.2" r="0.55" fill="currentColor" />
              <circle cx="5.8" cy="7.2" r="0.55" fill="currentColor" />
              <circle cx="5.8" cy="9.2" r="0.55" fill="currentColor" />
            </svg>
          </span>
          <span className="onyx-aulos-label">
            {playing ? "Aulos · playing" : AULOS_TITLE}
          </span>
        </button>
      )}

      {lyricsOpen && (
        <div
          className="onyx-share-scrim onyx-aulos-scrim"
          role="presentation"
          onPointerDown={e => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              closeLyrics();
            }
          }}
        >
          <div
            className="onyx-share-sheet onyx-aulos-sheet"
            role="dialog"
            aria-label={`${AULOS_TITLE} lyrics`}
            onPointerDown={e => e.stopPropagation()}
          >
            <p className="onyx-share-kicker">Hymn</p>
            <p className="onyx-aulos-title">{AULOS_TITLE}</p>
            <p className="onyx-aulos-status">
              {playing ? "Playing" : ended ? "Ended — tap reed to hear again" : "Paused"}
            </p>

            <div className="onyx-aulos-lyrics">
              {AULOS_SECTIONS.map((sec, i) => (
                <section key={`${sec.label}-${i}`} className="onyx-aulos-sec">
                  <p className="onyx-aulos-sec-label">{sec.label}</p>
                  {sec.lines.length === 0 ? (
                    <p className="onyx-aulos-instrumental">····</p>
                  ) : (
                    sec.lines.map((line, j) =>
                      line === "" ? (
                        <p key={j} className="onyx-aulos-break" />
                      ) : (
                        <p key={j} className="onyx-aulos-line">
                          {line}
                        </p>
                      ),
                    )
                  )}
                </section>
              ))}
            </div>

            <div className="onyx-aulos-actions">
              <button
                type="button"
                className="onyx-ghost-btn"
                onClick={e => {
                  e.stopPropagation();
                  const a = audioRef.current;
                  if (!a || !soundAllowed) return;
                  void pulseHaptic("tick");
                  if (a.paused) {
                    if (ended) {
                      a.currentTime = 0;
                      setEnded(false);
                    }
                    void a.play().catch(() => {});
                  } else {
                    a.pause();
                  }
                }}
              >
                {!soundAllowed ? "Sound is quiet" : playing ? "Pause" : ended ? "Play again" : "Play"}
              </button>
              <button
                type="button"
                className="onyx-share-cancel"
                onClick={e => {
                  e.stopPropagation();
                  closeLyrics();
                }}
              >
                Close lyrics
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
