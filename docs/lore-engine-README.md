# DELPHI — Lore Engine handoff

Drop-in package for Cursor. Contents:

## lib/lore/  → copy to agent/web/lib/lore/
- qualia.ts       — the mainframe: 356 entries, 18 systems, 8 axes (generated)
- compose.ts      — distillation engine (chorus-wide, names no system) + composeMoment()
- geoHeritage.ts  — land-first foregrounding + land acknowledgments
- cast.ts         — crypto-random draw (rejection sampling) + framing
- casting.ts      — three-phase ritual engine (Resonant Consent), gemstones, narration

## Root
- CURSOR-BRIEF.md    — the full build brief, in order, with invariants + addendum
- ASSET-MANIFEST.md  — exactly which Midjourney/SVG assets to make, slots, dimensions
- DELPHI-Qualia-Mainframe-v4.xlsx — the human-readable review sheet (all 356)

## data/
- data.json — the single source the .ts + xlsx are generated from

## generators/  (keep in repo; DON'T hand-edit qualia.ts)
- master.py    — moment systems + core cast entries
- complete.py  — sidereal 12, decans seated, Celtic 13, Cherokee moons, geo-origins
- decks.py     — full cast decks: tarot 78, I Ching 64, runes 24
- Regenerate:  python3 master.py && python3 complete.py && python3 decks.py
  (then regen qualia.ts — see the gen step, or ask for gen script)

## Build order: see CURSOR-BRIEF.md. Parts 0–3 first (engine), then UI, then casts.
## Invariants have tests — keep them green. The honesty boundaries (Orisha 8,
## foreground/acknowledge never composed, cast never in the moment) are the
## integrity of the whole app.
