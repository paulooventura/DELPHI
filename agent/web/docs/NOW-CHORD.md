# NOW-Chord — Heliodrome sonification (tunable)

Native Web Audio engine in `lib/heliodromeChord.ts` + constants in
`lib/heliodromeChordConfig.ts`. No Tone.js, no sample loops — continuous synth
so there is no audible seam. Shares `getClockAudio()`; arms after Allow-access.

## Hear it

1. Allow access (unlocks AudioContext).
2. Leave sound on (hex stone not muted).
3. Heliodrome filters still shape which lanes sing (`heliodromeLaneVoice`).
4. Freeze time parks sonics; Aulos ducks the chord.

## Constants (`NOW_CHORD`)

| Knob | Role |
|------|------|
| `ROOT_HZ` | Chord root — default `7.83 × 2^4` (Schumann raised into hearing) |
| `SCALE` | Semitone degrees every lane pitch is quantized to |
| `SCHUMANN_HZ` / `SCHUMANN_HARMONICS` | Bed LFO + infrasonic-feel oscillators |
| `MASTER_GAIN` | Overall loudness before bus compressor |
| `WHIR_CEILING_GAIN` | Cap on the fastest continuous band (floor texture) |
| `WHIR_SPEED` | `s` above this → continuous whir instead of pluck |
| `SLOW_BLOOM_S` / `DUCK_DB` / `DUCK_SEC` | Duck fast band when a slow lane blooms |
| `STRUCK_POOL` | Max concurrent struck / bell voices |
| `REVERSE_PITCH` | Flip fastest↔slowest pitch assignment |
| `TIC_DEGREE` / `TAC_DEGREE` | Second-lane tic/tac scale indices |
| `HOUR_STRIKE_GAP_S` / `HOUR_STRIKE_GAIN` | 12h civil-hour count striker |

Mix law (`voiceFromSpeed`): faster → quieter / shorter / darker / wider; slower → louder / longer / brighter / centered. **Pitch never follows Yin↔Yang** — only timbre/pan/filter.

## Voice map (first pass)

- **Bed:** Schumann-modulated root drone + harmonic stack.
- **Fast whir:** ms / other high-`s` lanes — noise+sine band, continuous.
- **Prāṇa:** whir with breathy lowpass swell tied to phase progress.
- **Sec:** tic/tac plucks alternating chord tones.
- **Mid / slow plucks:** lane-index crossings (min, ke, ghati, cultural lanes…).
- **Day lane rollover:** dedicated large-bell **hour count** (1–12 strikes).

Claude package target (more distinct cultural patches, Karplus nakshatra, etc.) can deepen these voices without changing the time core.

## Do not break

- Same JD / `computeOrreryState` / `resolveMoment` time core.
- Lane order slow→fast top→bottom.
- Freeze / mute / Aulos duck contracts.
- Orrery / PHASE goldens.

## Tune by ear

Edit `heliodromeChordConfig.ts` only first. Rebuild/push Delphi `main` and hard-refresh `?b=…`.
