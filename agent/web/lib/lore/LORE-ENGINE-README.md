# DELPHI — Lore Engine handoff (v5, complete)

478 entries · 24 systems · 8 axes · two tiers (measured/celebrated).

## lib/lore/  → copy to agent/web/lib/lore/
- qualia.ts       — the mainframe (generated; don't hand-edit)
- compose.ts      — distillation + composeMoment + composeLayers + takeSnapshot
- geoHeritage.ts  — land-first foregrounding + acknowledgments
- cast.ts         — crypto draw (rejection sampling) + framing
- casting.ts      — three-phase ritual engine, gemstones, narration

## Root docs — read in this order
1. README.md (this)
2. CURSOR-BRIEF.md  — full build, in order, + Addenda 1–3 (invariants throughout)
3. ASSET-MANIFEST.md — Midjourney/SVG assets, slots, dimensions
4. CLOCK-SPEC.md    — the stacked-lanes orrery clock
5. DELPHI-Qualia-Mainframe-v5.xlsx — human-readable review of all 478

## data/  — single source of truth
- data.json (the .ts + xlsx are generated from this)

## generators/  — regenerate, don't hand-edit qualia.ts
- master.py → complete.py → decks.py → pass_a.py  (run in that order)

## The spine: tier (measured vs celebrated) is the legitimacy model. The moment
## chord is computed-only. Cast never enters the moment. Orisha stays 8.
## foreground/acknowledge traditions never get composed. Keep all invariants green.
