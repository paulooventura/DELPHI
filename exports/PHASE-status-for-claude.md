# PHASE integration — status brief for Claude

All paths relative to `agent/web/`. Alias `@/*` → `agent/web/*`.

**TL;DR:** Tasks 1–6 are done, wired, and verified. `61/61` tests pass, `tsc --noEmit` clean. Two bugs in the shipped files were fixed (details below). Tasks 7–10 not started.

---

## Done & verified

### Task 1 — deps
Installed into `agent/web`: `luxon`, `tz-lookup`, `@types/luxon`, `@types/tz-lookup`.

### Task 2 — PHASE module dropped in
```
lib/phase/
  types.ts
  circular.ts
  timeResolution.ts
  engine.ts
  plugins/astronomical.ts
  phase.golden.test.ts
```
**35/35 golden tests pass** — known new/full moons, all four 2024 equinoxes/solstices, Mercury retrograde windows, historical DST offsets (America/Chicago, Europe/Lisbon), Julian-calendar conversion, Saturn/lunation returns, provenance + purity contracts.

#### Two fixes applied to your files
1. **Test import paths.** `phase.golden.test.ts` imported `../engine`, `../timeResolution`, `../circular`. Sitting beside the module in `lib/phase/`, those had to be `./engine`, `./timeResolution`, `./circular`. Fixed.
2. **`solar-day` off by a half cycle.** `Astronomy.HourAngle(Sun)` returns 0 at culmination (solar noon), but `compute()` mapped that to phase 0, so solar noon read as phase ~0 instead of 0.5 (the golden test and your own `derivation` string both expect 0.5 = noon). Fix in `plugins/astronomical.ts`:
   ```ts
   const ha = Astronomy.HourAngle(Astronomy.Body.Sun, t, observer); // 0 = culmination
   const phase = normalizePhase(ha / 24 + 0.5); // 0 = midnight, 0.5 = noon
   ```

### Task 3 — drift quantified (mean-period vs ephemeris)
Old `lunarPhaseFraction` vs PHASE `lunar-synodic`, 24 dates across 2026:
- **Max drift 18.9h** (2026-07-19), several samples 10–18h, typical 3–14h.
That's the justification for Tasks 4–5. (Throwaway script removed after capture.)

### Task 4 — `lib/worldCycles/plugins/lunar.ts` rewired
Now `computePhases(ctx.jd, { only: ["lunar-synodic"] })`. External shape preserved: `systemId`, `title`, `family`, `tier`, `region`, `color`, `icon`, `category`, `meta.phase/emoji/fraction`, `angleDeg`, `periodDays`. Changed `accuracy` `mean-orbit → astronomical`; `sources` now from astronomy-engine; added `meta.illuminatedFraction`. Phase-name lookup table kept (presentation). `worldCycles.golden.test.ts` passes unchanged.

### Task 5 — `lib/cosmic/CosmicClockEngine.ts` rewired
`tick()` makes one `computePhases(jdFromDate(now), { lat, lon })` call, replacing `lunarPhaseFraction`, `sunTropicalLongitude`, `precessionAngleDeg`, `solarDayAngleDeg`.

Mapping:
| CycleLayer id | PHASE reading | note |
|---|---|---|
| `solar-day` | `solar-day` | see convention note |
| `lunar-synodic` | `lunar-synodic` | illumination now from `meta.illuminatedFraction` |
| `sun-ecliptic` | `tropical-year` | via `meta.solarLongitudeDeg` |
| `precession` | `precession` | |

- Added optional `accuracy?: AccuracyTier` and `sources?: string[]` to `CycleLayer` in `lib/cosmic/types.ts` (Task 7 needs them) and populated them on those four layers.
- **Convention detail:** PHASE uses phase 0 = local midnight / 0.5 = solar noon, but the clock's existing convention puts solar noon at 0°. To keep the ring visually identical I shift by half a cycle: `angleDeg = normalizeDeg((solarDayReading.phase - 0.5) * 360)`, with a fallback to the old `solarDayAngleDeg` if PHASE skips solar-day (no location). **Flag for you:** if you'd rather adopt PHASE's convention natively and rotate the ring, that's a one-line change — tell me which you want.
- Untouched per your "one concern per PR": `barometric-breath`, `light-spectrum`, `tidal`, `muhurta`, `tzolkin`, `chinese-zodiac`.

### Task 6 — `lib/worldCycles/snapshotBridge.ts` spectrum derived
The seven hardcoded scores are gone. Spectrum is now built by mapping over `world.readings`, scoring each by its own `accuracy` tier and taking the note from its real `sources`:
```ts
const ACCURACY_SCORE = { astronomical: 0.95, arithmetical: 0.80, "mean-orbit": 0.65, symbolic: 0.40 };
const ACCURACY_AXIS  = { astronomical: "evidence", arithmetical: "cultural", "mean-orbit": "evidence", symbolic: "philosophical" };
```
Respects `enabledIds`, sorted by score desc. A plugin can no longer claim `symbolic` while the spectrum shows 0.94.

---

## Verification
- `npx vitest run` → **61/61 pass** (5 files: phase, worldCycles, orientation, sphericalView, deviceAttitude).
- `npx tsc --noEmit` → **clean, no errors**.
- No `next build` run yet; no git commit made (DELPHI isn't the auto-synced repo).

## Not started
- **Task 7** — visual confidence tiers (`observatoryTokens.ts`, `CosmicClockWheel.tsx`, `SteampunkWheelRing.tsx`, `RingFocusPanel.tsx`). The fields it needs (`accuracy`, `sources`) are now on `CycleLayer`.
- **Task 8** — natal mode. `timeResolution.ts` + `computeReturns` are ready; UI + `UserProfile` wiring pending.
- **Task 9** — tradition layers.
- **Task 10** — extended golden tests (more eclipses, deep-time equinoxes, southern-hemisphere births, zones that changed rules).

## Open questions for you
1. Solar-day angle: keep the clock's noon-at-0° convention (current) or adopt PHASE's midnight-at-0 and rotate the ring?
2. Want the derived spectrum capped/curated to N entries, or show every enabled reading (current behavior)?
3. `astronomy-engine` also exposes exact `SearchMoonPhase`/eclipse search — worth using for Task 10 reference values, or stick to the published catalogue you cited?

---

# Round 2 — acting on your feedback

Confirmed both fixes were correct (the `HourAngle` one was your bug — astronomy-engine returns 0 at culmination, your derivation string said 0 = midnight). Applied your calls:

### Perf (your "check before Task 7") — real, and worse than one call per frame
`useCosmicClock.ts` runs `engine.tick()` inside a `requestAnimationFrame` loop at `tickMs = 16` → **~60 Hz**. My Task 5 `tick()` was computing **all 10** astronomical cycles every frame (incl. 3 planet-synodic readings each doing double `GeoVector` + `PairLongitude` retrograde math) while consuming only 4.
- **Fix applied:** scoped the call — `computePhases(jd, { lat, lon, only: ["lunar-synodic","solar-day","tropical-year","precession"] })`. Cuts per-frame ephemeris from 10 cycles to 4, no behavior change.
- **Also noted (deferred):** `tick()` also calls `getCycleSnapshot(now)` every frame → `resolveWorldCycles` → all plugins, incl. the Task-4 lunar plugin which does its own `computePhases({only:["lunar-synodic"]})`. So `lunar-synodic` is computed twice per frame. Your `PhaseSnapshot`-through-`CycleContext` fix is the clean answer; leaving it until a profiler says so, per your note.

### Spectrum (your item 2) — grouped by axis, not ranked
Replaced the `sort((a,b) => b.score - a.score)` with grouping by `AXIS_ORDER = [evidence, cultural, philosophical]`, registry order within each band. Numeric `score` stays (the `CycleSnapshot["spectrum"]` type still requires it) but nothing new depends on the ordering being a ranking.

### Solar-day `displayOffset` (your item 1) — blocked on a bigger finding, see below
Added `accuracy?`/`sources?` to `CycleLayer` already. But before moving the shim to the render layer I traced what actually draws the rings, and found the render layer isn't where you think it is.

---

## ⚠️ Finding that changes the map: there are FOUR lunar pipelines, and the visible one is still on the old math

The clock the user sees is **not** rendered from `CosmicClockEngine`'s `CycleLayer[]`.

- `components/CosmicClockWheel.tsx` (the visible wheel, via `DashboardContainer`) renders a `CosmicTimeSnapshot` from **`lib/timeEngine.ts`** → `calculateCosmicTime()`.
- `timeEngine.ts` builds its lunar/solar/zodiac rings with the **old** `cosmic/math` functions:
  ```ts
  import { julianDay, lunarPhaseFraction, sunEclipticLongitudeDeg } from "./cosmic/math";
  // buildLunarRing → lunarPhaseFraction(date)   ← the 18.9h-drift mean-period math
  // buildSolarYearRing / buildZodiacRing → sunEclipticLongitudeDeg
  ```
- `CosmicClockEngine`'s `CycleLayer[]` (what Task 5 rewired) is consumed only by **readouts / focus UI**: `RingFocusPanel.tsx`, `CosmicNow.tsx`, `SpacetimeReadout.tsx`. Not the ring geometry.

So the four parallel lunar computations are:
1. `cosmic/math.ts::lunarPhaseFraction` (old) — **still feeds the visible wheel via timeEngine** ❌
2. `worldCycles/plugins/lunar.ts` — PHASE now ✅ (Task 4)
3. `cosmic/CosmicClockEngine.ts` — PHASE now ✅ (Task 5)
4. `timeEngine.ts::buildLunarRing` — **old math** ❌

**Consequence:** the drift fix has not reached the primary clock the user looks at. And `timeEngine.ts` carries its *own* provenance vocabulary — `RingProvenanceTier = "measured" | "computed" | "cultural"` + `ringProvenanceNote()` (e.g. ring 6 = "Synodic month · Meeus mean phase") — which is exactly the parallel-scheme problem, living in the render path.

**This reframes item 1 and Task 7:** `displayOffset` and the visual confidence tiers belong on `timeEngine`'s `ClockRingData` + `CosmicClockWheel`, and `timeEngine` needs to consume PHASE (a "Task 5b") before Task 7's tier styling means anything on the visible wheel. I did **not** rewire `timeEngine` yet — it's the primary clock and outside the Tasks 3–6 scope you set. Your call on sequencing.

### New questions
4. Rewire `timeEngine.ts` (`buildLunarRing`/`buildSolarYearRing`/`buildZodiacRing`) onto PHASE as "Task 5b" before Task 7? That's the change that actually lands the 18.9h fix on-screen.
5. Collapse `RingProvenanceTier` (measured/computed/cultural) into `AccuracyTier` + `ACCURACY_AXIS`, or keep timeEngine's names as a display alias?
6. `displayOffset` — put it on `ClockRingData` (timeEngine/CosmicClockWheel) rather than `CycleLayer`, agreed?

---

# Round 3 — Task 5b done (drift fix now reaches the visible clock)

Per your call: 5b before 7. Tests 61/61, `tsc --noEmit` clean.

**`lib/timeEngine.ts` rewired onto PHASE.** `calculateCosmicTime()` now makes one location-independent `computePhases(jd, { only: ["lunar-synodic","tropical-year"] })` and threads the snapshot into the ring builders:
- `buildLunarRing` → `lunar-synodic` (was `lunarPhaseFraction`, the 18.9h-drift math). Now shows real `illuminatedFraction` in the metadata.
- `buildSolarYearRing` / `buildZodiacRing` → `tropical-year` `meta.solarLongitudeDeg` (was `sunEclipticLongitudeDeg`).
- The visible `CosmicClockWheel` (via `DashboardContainer` → `calculateCosmicTime`) is now ephemeris-accurate. Pipeline #4 fixed.

**Q3 — `displayOffset` on `ClockRingData`.** Added `displayOffset?: number` (cycles, applied at render). Not set on any ring yet — none of the timeEngine rings currently need a zero-point shift, and I didn't want to introduce one speculatively. It's there for Task 7 / traditions.

**Q2 — one taxonomy, partial.** `ClockRingData` now carries `accuracy?: AccuracyTier` + `sources?: string[]`, populated on the three rewired rings from their PHASE readings. Fixed the lying `ringProvenanceNote` strings (ring 6 was literally "Meeus mean phase" — the math I just deleted): 6/7/9 now say "astronomy-engine …".
- **Deferred, needs your read:** the *full* collapse of `RingProvenanceTier` (`measured|computed|cultural`) into `AccuracyTier`+axis across **all** rings hit a semantic wrinkle. `ACCURACY_AXIS` maps `arithmetical → cultural`, but the civil-clock rings (ms/sec/min/hr, currently "measured") are exact civil time — they're `arithmetical` by precision yet not "cultural" as a kind of claim. So `AccuracyTier → axis` doesn't cleanly reproduce "measured". Options: (a) add a `civil`/`measured` tier or axis; (b) special-case clock rings; (c) accept clock rings landing in an "exact" band. I left `ringProvenanceTier`/`ringProvenanceNote` intact (still used by `DashboardContainer`) rather than force a broken mapping. Your call on how to model civil time in the one-taxonomy world.

**Old math deprecated (your "before you start 5b").** JSDoc `@deprecated` + PHASE pointer on `lunarPhaseFraction`, `precessionAngleDeg`, `sunTropicalLongitude`. Not deleted because:
- `lunarPhaseFraction` — **still a live caller: `lib/starmap.ts:143`** (the sky-map moon). That's your "fifth pipeline". Deprecating flags it with IDE strikethrough; want it migrated to PHASE too (separate small task), or left as-is for the star map?
- `precessionAngleDeg` — no live callers; deprecated to avoid a hard break, safe to delete whenever.
- `sunTropicalLongitude` — no live callers (repointed `sunConstellationDegree` off it); safe to delete.
- Left `sunEclipticLongitudeDeg` alone — it has legit consumers (`worldCycles/plugins/tropical.ts`, `spacetimeReference.ts`, tests, and internal RA/dec in `cosmic/math`) and the sun's position isn't the drift problem.

**60Hz note:** scoping fix stands. Your two-rate-tick idea (frame-rate for sensor/solar-day, 1s for everything ≥ a day incl. precession) noted for later — agreed precession at 60Hz is absurd; deferring until mobile budget demands it.

### Still-open for you
- **5c?** Migrate `starmap.ts` off `lunarPhaseFraction` to finish killing pipeline #5.
- **Q2 civil-time modeling** (above) before Task 7 styles tiers on every ring.
- Then **Task 7** proper.

---

# Round 4 — Task 5c + civil tier done

Tests 61/61, `tsc --noEmit` clean.

### 5c — starmap moon on PHASE (the one users check against the sky)
`lib/starmap.ts::moonPosition` now derives from PHASE:
```ts
const reading = computePhases(jdFromDate(date), { only: ["lunar-synodic"] }).byId["lunar-synodic"];
const illumination = Number(reading?.meta?.illuminatedFraction ?? 0); // real, not (1-cos(2π·phase))/2
phaseName: moonPhaseLabel(reading.phase)                              // phase-based → waxing/waning correct
```
Also fixed a latent bug: the old `moonPhaseLabel` did `abs(fraction*2-1)` and labeled both new and full as "Waning crescent". It now reads the synodic phase directly against the threshold table. Pipeline #5 dead.

### Deleted (not just deprecated) — all three, same PR
`lunarPhaseFraction`, `precessionAngleDeg` (from `cosmic/math.ts`), `sunTropicalLongitude` (from `cosmic/astronomy.ts`), plus their `cosmic/index.ts` re-exports. Repointed `sunConstellationDegree` to `sunEclipticLongitudeDeg`. Grep confirms zero remaining callers (the lingering hits are all the unrelated `CosmicClockState.lunarPhaseFraction` etc. **fields**, now populated from PHASE). Left `sunEclipticLongitudeDeg` alive — legit consumers, sun isn't the drift problem.

### Civil tier added (your Q2 fix)
```ts
export type AccuracyTier =
  | "astronomical" | "civil" | "arithmetical" | "mean-orbit" | "symbolic";
```
- `ACCURACY_SCORE` and `ACCURACY_AXIS` updated (`civil → evidence`, score 0.99). TS forced both — the two `Record<AccuracyTier,…>` were the only sites, and now `arithmetical → cultural` is correct rather than overloaded, exactly as you said.
- `gregorian` plugin: `arithmetical → civil`.
- Tiered the timeEngine rings while the taxonomy was fresh: ms/sec/min/hr → `civil`; kè/shí/tzolkin/sexagenary → `arithmetical`; lunar/solar → `astronomical`.

### ⚠️ One categorization I did NOT force: the zodiac
`buildZodiacRing` currently carries `accuracy: "astronomical"` (it's the same ephemeris solar longitude as the solar ring). But you said "the zodiac is symbolic," and for Task 7 styling it should read as symbolic, not as a measurement. That exposes a tension in the single-field model: the zodiac's **number** is astronomical, its **claim** is symbolic. Tzolkin doesn't have this (arithmetical number + cultural claim both point the same way); the zodiac does.

Options for Task 7:
- (a) set the zodiac ring's `accuracy: "symbolic"` and accept that "accuracy" then means "kind of claim", not "precision";
- (b) keep `accuracy` as precision and add a separate `kind`/`claim` field that Task 7 styling reads;
- (c) leave zodiac astronomical and treat sign-labeling as presentation.

I left it astronomical pending your call — it's the one place your one-taxonomy model and the four-band styling story might need a second field.

### Still open
- **Q2 zodiac** (above) — decide before Task 7 styles tiers.
- **Task 7** — four-band visual styling (civil / astronomical / arithmetical / symbolic → exact-by-definition / by-observation / by-rule / authored), gated on the screenshot test: rings distinguishable as measurement vs interpretation without reading labels.
- Two-rate tick (precession off the 60Hz path) — deferred until mobile budget needs it.

---

# Appendix — full diffs

## A. Edits to your shipped files (`lib/phase/`)

These two files came from the zip. I changed only the lines below.

### `lib/phase/phase.golden.test.ts` — import paths (`../` → `./`)
```diff
-import { computePhases, computeCouplings, computeReturns } from "../engine";
-import { jdFromDate, resolveBirthTime, julianToGregorian } from "../timeResolution";
-import { circularMean, nearestSimpleRatio, phaseDelta, normalizePhase } from "../circular";
+import { computePhases, computeCouplings, computeReturns } from "./engine";
+import { jdFromDate, resolveBirthTime, julianToGregorian } from "./timeResolution";
+import { circularMean, nearestSimpleRatio, phaseDelta, normalizePhase } from "./circular";
```

### `lib/phase/plugins/astronomical.ts` — `solar-day` half-cycle offset
```diff
-    const ha = Astronomy.HourAngle(Astronomy.Body.Sun, t, observer); // hours, 0–24
-    const phase = normalizePhase(ha / 24);
+    const ha = Astronomy.HourAngle(Astronomy.Body.Sun, t, observer); // hours, 0–24; 0 = culmination (solar noon)
+    // Offset by half a cycle so phase 0 = local apparent midnight, 0.5 = solar noon.
+    const phase = normalizePhase(ha / 24 + 0.5);
```

The rest of `types.ts`, `circular.ts`, `timeResolution.ts`, `engine.ts`, `plugins/astronomical.ts` are your originals verbatim.

## B. Rewires to existing app files (git diff)

### `lib/cosmic/CosmicClockEngine.ts`
```diff
 import { getCycleSnapshot } from "../cycleSystems";
-import { computeSolarDayEvents, sunTropicalLongitude } from "./astronomy";
+import { computePhases } from "../phase/engine";
+import { jdFromDate } from "../phase/timeResolution";
+import { computeSolarDayEvents } from "./astronomy";
 import {
-  lunarPhaseFraction,
   muhurtaPhase,
   normalizeDeg,
-  precessionAngleDeg,
   PRECESSION_PERIOD_YEARS,
   solarDayAngleDeg,
   tideCycle,
 } from "./math";
@@ tick() @@
     const solar = computeSolarDayEvents(dayLocal, lat, lon);
-    const lunarPhase = lunarPhaseFraction(now);
+
+    // Ephemeris spine: one pure PHASE call replaces the mean-period arithmetic.
+    // Drift vs the old math ran up to ~19h for the Moon and days for Mercury.
+    const phases = computePhases(jdFromDate(now), { lat, lon });
+    const lunarReading = phases.byId["lunar-synodic"];
+    const solarDayReading = phases.byId["solar-day"];
+    const tropReading = phases.byId["tropical-year"];
+    const precReading = phases.byId["precession"];
+
+    const lunarPhase = lunarReading?.phase ?? 0;
     const lunarAngleDeg = normalizeDeg(lunarPhase * 360);
     const tide = tideCycle(now, lunarPhase);
     const muhurta = muhurtaPhase(now, solar.sunrise);
-    const sunLon = sunTropicalLongitude(now);
-    const precession = precessionAngleDeg(now);
-    const solarDayAngle = solarDayAngleDeg(now, solar.solarNoon);
+    const sunLon = tropReading
+      ? normalizeDeg(Number(tropReading.meta?.solarLongitudeDeg ?? tropReading.angleDeg))
+      : 0;
+    const precession = precReading?.angleDeg ?? 0;
+    // PHASE convention: phase 0 = local midnight, 0.5 = solar noon. The clock's
+    // existing convention puts solar noon at 0°, so shift by half a cycle to keep
+    // the ring visually unchanged. Fall back to the old solver if PHASE skipped it.
+    const solarDayAngle = solarDayReading
+      ? normalizeDeg((solarDayReading.phase - 0.5) * 360)
+      : solarDayAngleDeg(now, solar.solarNoon);
@@ solar-day layer @@
         color: "#f59e0b",
+        accuracy: solarDayReading?.accuracy ?? "astronomical",
+        sources: solarDayReading?.sources ?? ["equation of time + observer longitude"],
@@ lunar-synodic layer @@
         color: "#94a3b8",
-        meta: { illumination: Math.round(lunarPhase * 1000) / 10 },
+        accuracy: lunarReading?.accuracy ?? "astronomical",
+        sources: lunarReading?.sources ?? ["astronomy-engine MoonPhase"],
+        meta: {
+          illumination: Math.round(Number(lunarReading?.meta?.illuminatedFraction ?? lunarPhase) * 1000) / 10,
+        },
@@ sun-ecliptic layer @@
         color: "#f97316",
+        accuracy: tropReading?.accuracy ?? "astronomical",
+        sources: tropReading?.sources ?? ["astronomy-engine SunPosition"],
@@ precession layer @@
         color: "#6366f1",
+        accuracy: precReading?.accuracy ?? "mean-orbit",
+        sources: precReading?.sources ?? ["IAU 2006 precession rate, linear approximation"],
```

### `lib/cosmic/types.ts`
```diff
+import type { AccuracyTier } from "../worldCycles/types";
+
 /** Tier 1 = innermost sensor pulse → Tier 6 = precession rim */
 export type CycleTier = 1 | 2 | 3 | 4 | 5 | 6;
@@ CycleLayer @@
   meta: Record<string, string | number | boolean | null>;
+  /** Provenance tier — present on ephemeris-backed layers. Drives visual confidence (Task 7). */
+  accuracy?: AccuracyTier;
+  /** How the value was derived (data sources). */
+  sources?: string[];
 };
```

### `lib/worldCycles/plugins/lunar.ts`
```diff
 import type { CyclePlugin } from "../types";
+import { computePhases } from "@/lib/phase/engine";
 
-const KNOWN_NEW_MOON = Date.parse("2000-01-06T18:14:00Z");
 const SYNODIC = 29.530588853;
+
+// Phase-name lookup is presentation, not math — thresholds over synodic position.
 const PHASES: [number, string, string][] = [ /* unchanged */ ];
@@ resolve(ctx) @@
-    const elapsed = (ctx.instant.getTime() - KNOWN_NEW_MOON) / 86400000;
-    const fraction = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
-    const angleDeg = fraction * 360;
+    // Ephemeris-derived synodic phase (astronomy-engine), not mean-period arithmetic.
+    const reading = computePhases(ctx.jd, { only: ["lunar-synodic"] }).byId["lunar-synodic"]!;
+    const fraction = reading.phase;
+    const angleDeg = reading.angleDeg;
+    const illum = Number(reading.meta?.illuminatedFraction ?? 0);
     const found = PHASES.find(([t]) => fraction < t) ?? PHASES[PHASES.length - 1]!;
     return {
       ...
-      secondary: `${(fraction * 100).toFixed(0)}% illuminated cycle`,
+      secondary: `${(illum * 100).toFixed(0)}% illuminated`,
       ...
       meta: {
         phase: found[1],
         emoji: found[2],
         fraction: Number(fraction.toFixed(6)),
+        illuminatedFraction: Number(illum.toFixed(4)),
       },
-      accuracy: "mean-orbit",
-      sources: ["Synodic month from known new moon 2000-01-06"],
+      accuracy: "astronomical",
+      sources: reading.sources,
```

### `lib/worldCycles/snapshotBridge.ts`
```diff
-import type { CycleReading, WorldCycleSnapshot } from "./types";
+import type { AccuracyTier, CycleReading, WorldCycleSnapshot } from "./types";
+
+const ACCURACY_SCORE: Record<AccuracyTier, number> = {
+  astronomical: 0.95,
+  arithmetical: 0.8,
+  "mean-orbit": 0.65,
+  symbolic: 0.4,
+};
+
+const ACCURACY_AXIS: Record<AccuracyTier, "evidence" | "cultural" | "philosophical"> = {
+  astronomical: "evidence",
+  arithmetical: "cultural",
+  "mean-orbit": "evidence",
+  symbolic: "philosophical",
+};
@@ worldCyclesToCycleSnapshot() @@
-  const spectrum: CycleSnapshot["spectrum"] = [
-    { name: "Gregorian", axis: "evidence", score: 0.97, note: "Astronomical/civil standard, internationally verified." },
-    { name: "Moon Phase", axis: "evidence", score: 0.94, note: "Computed from Synodic period — precise to within hours." },
-    { name: "Hijri / Hebrew / Persian", axis: "cultural", score: 0.82, note: "Tier A living calendars via World Cycle registry." },
-    { name: "Chinese Lunisolar", axis: "cultural", score: 0.74, note: "CNY-aware year + synodic month index." },
-    { name: "Tzolkin (Mayan)", axis: "cultural", score: 0.64, note: "260-day ceremonial cycle with correlation choice." },
-    { name: "13:20 Frequency", axis: "philosophical", score: 0.58, note: "13 Tones × 20 Tribes synchronization." },
-    { name: "Tropical Zodiac", axis: "philosophical", score: 0.5, note: "Solar λ tropical signs — no date-cutoff drift." },
-  ];
+  // Derived from each reading's own accuracy tier + sources, not literals.
+  const spectrumEnabled = (r: CycleReading) => !enabledIds || enabledIds.includes(r.systemId);
+  const spectrum: CycleSnapshot["spectrum"] = world.readings
+    .filter(spectrumEnabled)
+    .map((r) => ({
+      name: r.title,
+      axis: ACCURACY_AXIS[r.accuracy],
+      score: ACCURACY_SCORE[r.accuracy],
+      note: r.sources.length > 0 ? r.sources.join("; ") : r.accuracy,
+    }))
+    .sort((a, b) => b.score - a.score);
```
