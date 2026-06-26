# COSMOS — Cosmic Clock module for DELPHI (Next.js)

A self-contained feature module: cross-cultural time synthesis, a live
3D sky map, and a per-moment "essence" reading. Built to drop into
DELPHI's existing Next.js (app-router) codebase — **not** a separate
Vite app, so it shares your bundler, fonts, and deploy.

## What changed vs. the original COSMOS prompt

The prompt assumed Vite. DELPHI is Next.js, so:

- No Vite config / `main.tsx`. The entry is an app-router page
  (`app/cosmos/page.tsx`) rendering a client shell.
- `SkyMap` (Three.js) is loaded via `next/dynamic` with `ssr: false`
  because it touches `window`. Everything else SSRs fine.
- Browser APIs (DeviceOrientation, Geolocation, Vibration) are all
  guarded so server render never throws.

Everything else from the spec is here: Zustand store, three-tab shell,
floating nav, the mechanical SVG clock, the AR sky map with gyro +
pinch-FOV + center-raycaster haptics, weather via Open-Meteo, and the
synthesis engine.

## Install

```bash
npm i zustand framer-motion three @react-three/fiber @react-three/drei @use-gesture/react
npm i -D @types/three
# luxon is in the spec but the engine uses native Date + Julian Day math.
# add it only if you want richer tz handling: npm i luxon @types/luxon
```

Requires the `@/*` path alias. In DELPHI the Next.js app root is **`agent/web/`**
(not `src/`). `tsconfig.json` there maps `@/*` → `./*`:

```json
// agent/web/tsconfig.json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

So `@/components/CosmosShell` resolves to `agent/web/components/CosmosShell.tsx`,
`@/services/astronomyEngine` → `agent/web/services/astronomyEngine.ts`, etc.

## File tree (DELPHI)

```
agent/web/
  app/cosmos/page.tsx        route entry (/cosmos) — app router
  components/
    CosmosShell.tsx          client root: clock boot, onboarding, tab routing
    NavBar.tsx               floating bottom nav (COSMOS; distinct from BottomNav)
    CosmicClock.tsx          concentric SVG wheel (ported, math-validated)
    SkyMap.tsx                 R3F sphere — gyro, pinch-zoom, haptic lock
    MomentReading.tsx        cinematic essence reading
  services/
    astronomyEngine.ts       JD math, positions, all cultural cycles
    weatherService.ts        Open-Meteo (keyless)
    synthesisEngine.ts       deterministic archetypal synthesis
  store/useCosmosStore.ts    Zustand: time loop, sensors, geo, weather
  types/cosmos.ts            shared types
```

## Validation

The astronomy math is checked against known anchors:

- Vernal equinox (2000-03-20) → Sun at Aries 0.2°
- Summer solstice (2024-06-21) → Sun at Cancer 0.6°
- 2012-12-21 → Tzolk'in **4 Ajaw** (GMT 584283 correlation)

These are low-precision formulae — accurate to a fraction of a degree,
right for driving the wheel and placing sky dots, **not** chart-grade.
For natal-chart precision, swap `astronomyEngine` internals for the
`astronomia` npm package or Swiss Ephemeris; the typed return shapes
(`CycleState[]`, `CelestialBody[]`) stay the same so nothing else moves.

## Fonts

Components reference `var(--font-display)`. Wire it in your root layout
(e.g. `next/font` Cinzel or Cormorant) or delete the inline `style` —
it falls back to `serif`.

## Known follow-ups (deliberately left open)

- Sky map has no drag-fallback when there's no gyro (desktop). Stubbed
  with a message; add OrbitControls if you want desktop look-around.
- Planet positions use mean longitudes (no equation of center) — fine
  for dots, off by up to ~1–2° for inner planets.
- Birth-chart layer in synthesis reads `profile.birthISO` but only
  uses it as a hook today; the natal overlay is the next build.
- Moon ecliptic latitude is approximated; nodes not modeled.
