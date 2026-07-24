# PHASE — ephemeris spine & the provenance taxonomy

PHASE is the single source of cycle *numbers* (lunar phase, solar longitude, precession,
planet synodics, …). It replaced five drifting mean-period pipelines (`cosmic/math`'s
`lunarPhaseFraction`, `sunTropicalLongitude`, `precessionAngleDeg`, plus duplicates in
`timeEngine` and `starmap`) — the Moon alone had run up to ~19h off. `computePhases(jd, …)`
is the one call; scope it with `only: [...]` on hot paths (the 60 Hz clock uses four cycles,
not ten).

Most of the code explains itself. Two decisions do **not**, and they're the invariants
someone will unknowingly break first. The tests guard the mechanics; this guards the *why*.

## 1. `AccuracyTier` and `ClaimKind` are separate fields, on purpose

They answer different questions and are genuinely orthogonal:

- **`AccuracyTier`** — how precisely the *number* was derived: `astronomical` (ephemeris,
  sub-arcminute), `civil` (exact by definition), `arithmetical` (exact by rule),
  `mean-orbit` (real periodicity, approximated).
- **`ClaimKind`** — what *kind of claim* the ring/reading makes: `measurement` (this is
  where the thing is), `convention` (this is what we agreed to call it), `interpretation`
  (this is what someone says it means).

**The one-sentence proof is the zodiac ring:** its number is `astronomical` (ephemeris
longitude, sub-arcminute) and its claim is `interpretation` (that a position corresponds to
a character — a Hellenistic convention, ~2nd c. BCE). Both are true at once. Collapsing them
loses information either way — mark it `symbolic` and the app lies about a number it computes
exactly; drop the interpretive tag and it hides the authored move DELPHI exists to surface.

`symbolic` was removed from `AccuracyTier` in this split — it was never a precision level,
which is why it kept fighting the axis map. Every tradition layer (Task 9) is
precise-number-plus-authored-meaning, so the taxonomy has to express both.

## 2. Visual styling reads `ClaimKind`, never `AccuracyTier`

`lib/design/claimMarks.ts` maps `ClaimKind` → three *different kinds of mark* (not a
strong→weak gradient), at **full opacity for all three**:

- `measurement` → graduated instrument ticks.
- `convention` → discrete unit dividers.
- `interpretation` → detached band: inset with a visible gap, dashed boundary, no ticks.

The gradient tracks *what kind of claim*, not *how good the number is*. A Tzolkin ring must
not look like a degraded lunar ring — it's a different category, not a worse measurement.
If styling ever keys off `AccuracyTier`, the zodiac ring exposes it: it would render as a
precise measurement instead of the interpretation it is.

Guards: `lib/design/claimMarks.test.ts` (each pair of kinds differs on ≥2 independent
properties; opacity identical) and `lib/claimTaxonomy.test.ts` (the accuracy-leak guard:
different accuracy + same claim → **identical** marks). The tests catch a regression; they
don't explain the reasoning — that's this file.
