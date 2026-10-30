"use client";

/**
 * Permission screen after splash:
 * Locked-off void film plays once → freezes on last frame.
 * At ~3/4 duration the purple octagon crystal fades in; “Continue”
 * rises from its center slightly later and keeps glowing until tap.
 * Soundtrack dissolves via AudioBus delay tail (no hard cut).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { isNativeShell } from "../../lib/native/shell";
import { getClockAudio, resumeClockAudio } from "../../lib/clockSfx";
import {
  AUDIO_BUS,
  connectClipWithTail,
  ensureAudioBus,
  fadeIn,
  fadeOut,
} from "../../lib/audioBus";
import { CAKE_LAST_FRAME } from "./OnyxSplash";

const VOID_VIDEO = `/pneuma-boot-void.mp4?v=${DELPHI_BUILD}`;
const VOID_AUDIO = `/pneuma-boot-void-audio.m4a?v=${DELPHI_BUILD}`;
const CRYSTAL = `/allow-access-crystal.png?v=${DELPHI_BUILD}`;

/** Crystal reveal at 75% of clip; phrase shortly after. */
const CRYSTAL_AT = 0.75;
const PHRASE_AFTER_CRYSTAL_S = 0.55;
/** Swallows the trailing click from a splash skip tap. */
const ARM_MS = 600;
const noSubscribe = () => () => {};

/** Crystal and phrase over the held cake frame when the opening already played the film. */
const HELD_CRYSTAL_MS = 250;
const HELD_PHRASE_MS = 800;

export function DeviceAccessGate({
  onAllow,
  onLater,
  busy = false,
  fromCake = false,
}: {
  onAllow: () => void;
  onLater?: () => void;
  busy?: boolean;
  /** The opening just ended on the cake film: hold its last frame, its bed has played. */
  fromCake?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const dissolveRef = useRef<((onDone?: () => void) => void) | null>(null);
  const crystalTimer = useRef<number | null>(null);
  const phraseTimer = useRef<number | null>(null);
  const [crystalOn, setCrystalOn] = useState(false);
  const [phraseOn, setPhraseOn] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const armedAt = useRef(0);
  const native = useSyncExternalStore(noSubscribe, isNativeShell, () => false);

  useEffect(() => {
    armedAt.current = Date.now() + ARM_MS;
  }, []);

  useEffect(() => {
    if (!fromCake) return;
    setFrozen(true);
    const c = window.setTimeout(() => setCrystalOn(true), HELD_CRYSTAL_MS);
    const p = window.setTimeout(() => setPhraseOn(true), HELD_PHRASE_MS);
    return () => {
      window.clearTimeout(c);
      window.clearTimeout(p);
    };
  }, [fromCake]);

  useEffect(() => {
    if (fromCake) return;
    let cancelled = false;
    const v = videoRef.current;

    const clearCueTimers = () => {
      if (crystalTimer.current != null) {
        window.clearTimeout(crystalTimer.current);
        crystalTimer.current = null;
      }
      if (phraseTimer.current != null) {
        window.clearTimeout(phraseTimer.current);
        phraseTimer.current = null;
      }
    };

    const scheduleOverlays = (durationS: number) => {
      clearCueTimers();
      const crystalMs = Math.max(0, durationS * CRYSTAL_AT * 1000);
      const phraseMs = crystalMs + PHRASE_AFTER_CRYSTAL_S * 1000;
      crystalTimer.current = window.setTimeout(() => {
        if (!cancelled) setCrystalOn(true);
      }, crystalMs);
      phraseTimer.current = window.setTimeout(() => {
        if (!cancelled) setPhraseOn(true);
      }, phraseMs);
    };

    const freezeLastFrame = () => {
      if (!v || cancelled) return;
      try {
        if (Number.isFinite(v.duration) && v.duration > 0) {
          v.currentTime = Math.max(0, v.duration - 0.05);
        }
      } catch {
        /* ignore */
      }
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      setFrozen(true);
      setCrystalOn(true);
      setPhraseOn(true);
    };

    const onMeta = () => {
      if (cancelled || !v) return;
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
      scheduleOverlays(d);
    };
    const onEnded = () => freezeLastFrame();

    if (v) {
      v.muted = true;
      v.loop = false;
      v.playsInline = true;
      v.addEventListener("loadedmetadata", onMeta);
      v.addEventListener("ended", onEnded);
      if (v.readyState >= 1) onMeta();
      void v.play().catch(() => {
        scheduleOverlays(0.4);
      });
    }

    (async () => {
      try {
        const ctx = (await resumeClockAudio()) ?? getClockAudio();
        if (!ctx || cancelled) return;
        ensureAudioBus(ctx);
        const res = await fetch(VOID_AUDIO);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (cancelled) return;

        fadeOut("splash", 80);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const { dry, stopDissolve } = connectClipWithTail(ctx, src);
        const t0 = ctx.currentTime;
        dry.gain.setValueAtTime(AUDIO_BUS.SILENCE, t0);
        dry.gain.exponentialRampToValueAtTime(1, t0 + AUDIO_BUS.CLIP_FADE_IN_MS / 1000);
        fadeIn("splash", AUDIO_BUS.CLIP_FADE_IN_MS, 1);
        src.onended = () => {
          if (srcRef.current === src) {
            srcRef.current = null;
            stopDissolve();
          }
        };
        src.start(0);
        srcRef.current = src;
        dissolveRef.current = stopDissolve;
      } catch {
        /* visual gate still works without bed */
      }
    })();

    return () => {
      cancelled = true;
      clearCueTimers();
      if (v) {
        v.removeEventListener("loadedmetadata", onMeta);
        v.removeEventListener("ended", onEnded);
      }
      const dissolve = dissolveRef.current;
      dissolveRef.current = null;
      if (dissolve) {
        dissolve(() => {
          try {
            srcRef.current?.stop();
          } catch {
            /* ignore */
          }
          srcRef.current = null;
        });
      } else {
        try {
          srcRef.current?.stop();
        } catch {
          /* ignore */
        }
        srcRef.current = null;
        fadeOut("splash", AUDIO_BUS.CLIP_FADE_OUT_MS);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="onyx-root" role="dialog" aria-label="Location, motion and sound">
      <div className={`onyx-device onyx-access-gate${frozen ? " frozen" : ""}`}>
        <button
          type="button"
          className={`onyx-access-cta${busy ? " busy" : ""}${phraseOn ? " lit" : ""}`}
          disabled={busy}
          onClick={() => {
            if (Date.now() < armedAt.current) return;
            onAllow();
          }}
        >
          {fromCake ? (
            <img className="onyx-access-backdrop" src={CAKE_LAST_FRAME} alt="" aria-hidden draggable={false} />
          ) : (
            <video
              ref={videoRef}
              className="onyx-access-backdrop"
              src={VOID_VIDEO}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-hidden
            />
          )}
          <span className="onyx-access-stage" aria-hidden={!crystalOn && !phraseOn}>
            <img
              className={`onyx-access-crystal${crystalOn ? " on" : ""}`}
              src={CRYSTAL}
              alt=""
              draggable={false}
            />
            <span className={`onyx-access-cta-label${phraseOn ? " on" : ""}`}>
              {busy ? "Requesting…" : "Continue"}
            </span>
          </span>
        </button>
        {onLater ? (
          <button
            type="button"
            className={`onyx-access-later${phraseOn ? " on" : ""}`}
            disabled={busy}
            onClick={() => {
              if (Date.now() < armedAt.current) return;
              onLater();
            }}
          >
            Not now
          </button>
        ) : null}
        <ul className="onyx-access-why">
          <li><b>Location</b> places the real sky over you.</li>
          <li><b>Motion</b> lets you point your phone at the planets.</li>
          <li><b>Sound</b> plays the chord of this moment.</li>
          {native ? (
            <li><b>Anonymous usage counts</b> stay off unless you choose Share under About.</li>
          ) : (
            <li><b>Anonymous usage counts</b> (screens and taps, never what you type) tune Pneuma. Turn them off under About.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
