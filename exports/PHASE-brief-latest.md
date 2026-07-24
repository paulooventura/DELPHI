# PHASE integration — consolidated status brief

For Claude. Single current-state snapshot (supersedes the round-by-round log in `PHASE-status-for-claude.md`). All paths under `agent/web/`; alias `@/*` → `agent/web/*`.

**State:** Tasks 1–6 + 5b + 5c done and verified. **61/61 tests pass, `tsc --noEmit` clean.** All five lunar computation pipelines now run on the ephemeris. Task 7 (visual tiers) not started — blocked on one design decision (the zodiac, below).

---

## What's landed

### Foundation (Tasks 1–3)
- Deps: `luxon`, `tz-lookup` (+ `@types/*`).
- PHASE module in `lib/phase/` (`types`, `circular`, `timeResolution`, `engine`, `plugins/astronomical`, `phase.golden.test`). **35 golden tests** vs published ephemerides: new/full moons, all four 2024 equinoxes/solstices, Mercury retrograde windows, historical DST, natal returns.
- Two bugs fixed in the shipped files: test import paths (`../` → `./`), and `solar-day` half-cycle offset (`HourAngle` returns 0 at culmination; derivation said 0 = midnight — added `+0.5`).
- Drift quantified: old mean-period lunar vs PHASE = **up to 18.9h** (Moon a full sign off, worst case).

### Engine rewires (Tasks 4–6)
- `worldCycles/plugins/lunar.ts` → PHASE `lunar-synodic`; `accuracy` `mean-orbit → astronomical`; adds `illuminatedFraction`.
- `cosmic/CosmicClockEngine.ts` → one `computePhases()` for lunar/solar-day/tropical/precession; added `accuracy?`/`sources?` to `CycleLayer`.
- `worldCycles/snapshotBridge.ts` → spectrum **derived** from each reading's `accuracy` tier (was 7 hardcoded scores), **grouped by axis** (evidence/cultural/philosophical), not ranked by score.

### Perf fix (your pre-Task-7 flag)
`useCosmicClock` ticks `engine.tick()` at ~60 Hz (rAF loop, `tickMs=16`). `tick()` was computing all 10 cycles/frame; scoped to the 4 consumed (`only: [...]`). Deferred (per you): the deeper `PhaseSnapshot`-through-`CycleContext` de-dup, and a two-rate tick (precession off the frame loop).

### Task 5b — the visible clock (this was the real gap)
The on-screen wheel is **not** rendered from `CosmicClockEngine`. `CosmicClockWheel` (via `DashboardContainer`) renders `lib/timeEngine.ts::calculateCosmicTime()`, whose `buildLunarRing`/`buildSolarYearRing`/`buildZodiacRing` still used the **old** math — so the 18.9h error was live on the primary clock.
- Rewired all three onto PHASE (one threaded `computePhases(jd, { only: ["lunar-synodic","tropical-year"] })`).
- Added `accuracy?`/`sources?`/`displayOffset?` to `ClockRingData` (`displayOffset` per your Q3 — declared per-ring, applied at render; not set on any ring yet, none need a zero-point shift today).
- Fixed lying provenance notes (ring 6 literally said "Meeus mean phase" — the math being removed).

### Task 5c — starmap moon (highest-value, per you)
`lib/starmap.ts::moonPosition` → PHASE: real `illuminatedFraction`, phase-based `phaseName` (waxing/waning correct). Fixed a latent labeling bug (old code labeled both new and full "Waning crescent"). This is the one cycle users can check against the actual sky.

### Cleanup — deleted the old math (same PR)
Removed `lunarPhaseFraction`, `precessionAngleDeg`, `sunTropicalLongitude` and their `cosmic/index.ts` re-exports; repointed `sunConstellationDegree`. Zero remaining callers (leftover grep hits are unrelated `CosmicClockState` field names, now fed from PHASE). Kept `sunEclipticLongitudeDeg` (legit consumers; the sun isn't the drift problem).

### Q2 — one taxonomy, `civil` tier added
Your call: the "measured" snag meant the taxonomy was incomplete, not that the map needed a special case. Added a fourth kind:
```ts
export type AccuracyTier =
  | "astronomical"  // ephemeris-derived, sub-arcminute
  | "civil"         // exact by definition — clock/calendar conventions
  | "arithmetical"  // exact rule-based over a cultural system
  | "mean-orbit"    // real periodicity, approximated
  | "symbolic";     // interpretive, meaning is authored
```
- `ACCURACY_SCORE` + `ACCURACY_AXIS` updated (`civil → evidence`); TS forced both (the only two `Record<AccuracyTier,…>`). `arithmetical → cultural` is now correct, not overloaded.
- `gregorian → civil`. timeEngine rings tiered: ms/sec/min/hr → `civil`; kè/shí/tzolkin/sexagenary → `arithmetical`; lunar/solar → `astronomical`.

---

## The lunar pipelines — before vs after

| # | Pipeline | Before | Now |
|---|---|---|---|
| 1 | `cosmic/math.ts` `lunarPhaseFraction` | old, fed timeEngine | **deleted** |
| 2 | `worldCycles/plugins/lunar.ts` | mean-orbit | PHASE ✅ |
| 3 | `cosmic/CosmicClockEngine.ts` | old | PHASE ✅ |
| 4 | `timeEngine.ts` (visible wheel) | **old** | PHASE ✅ |
| 5 | `starmap.ts` (sky-map moon) | **old** | PHASE ✅ |

---

## Open decisions for you

1. **Zodiac categorization (blocks Task 7).** `buildZodiacRing` is `astronomical` (same ephemeris longitude as the solar ring), but you said the zodiac is symbolic. Tension: its **number** is astronomical, its **claim** is symbolic — unlike Tzolkin, where arithmetical + cultural agree. Options:
   - (a) set zodiac `accuracy:"symbolic"` → "accuracy" now means *kind of claim*, not precision;
   - (b) keep `accuracy` = precision, add a separate `kind`/`claim` field Task 7 styling reads;
   - (c) treat sign-labeling as pure presentation, ring stays astronomical.
   This decides whether the one-field model survives or needs a second axis field.

2. **Task 7 — four-band visual styling.** civil / astronomical / arithmetical / symbolic → exact-by-definition / by-observation / by-rule / authored. Fields (`accuracy`, `sources`, `displayOffset`) are in place on both `CycleLayer` and `ClockRingData`. Consumers to touch per your earlier note: `observatoryTokens.ts`, `CosmicClockWheel.tsx`, `SteampunkWheelRing.tsx`, `RingFocusPanel.tsx`. Acceptance = the screenshot test: rings readable as measurement vs interpretation without labels.

3. **Deferred, non-blocking:** two-rate tick (precession off the 60 Hz path); `PhaseSnapshot`-through-`CycleContext` to kill the double lunar compute per frame.

---

## Verify locally
```bash
cd agent/web
npx vitest run      # 61/61
npx tsc --noEmit    # clean
```
Full diffs for every change are appended in `PHASE-status-for-claude.md`.
