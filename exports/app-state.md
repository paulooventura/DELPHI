# DELPHI — Current App State

Snapshot for sharing with Claude. Generated Fri Jul 24, 2026.

## Key context

- **Framework:** Next.js 16.2.9 (App Router) + React 19.2.4
- **Styling:** Tailwind CSS v4, global styles in `app/globals.css`
- **Tests:** Vitest
- **App location:** the app lives in **`agent/web`** (NOT `src`)
- **Path alias:** `@/*` maps to **`./*`** (the `agent/web` root), NOT `./src`
- Provenance / synthesis work most likely touches: `lib/researchEngine.ts`, `lib/synthesisFromSnapshot.ts`, `services/synthesisEngine.ts`

## Directory tree — `agent/web` (depth 4, node_modules/.next excluded)

```
agent/web
|-- app
|   |-- api
|   |   |-- cycles
|   |   |   `-- route.ts
|   |   |-- research
|   |   |   |-- stream
|   |   |   |-- v2
|   |   |   `-- route.ts
|   |   `-- sky
|   |       |-- aircraft
|   |       |-- declination
|   |       |-- nearby-airports
|   |       `-- satellites
|   |-- cosmos
|   |   `-- page.tsx
|   |-- favicon.ico
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components
|   |-- oracle
|   |   |-- OracleLogo.tsx
|   |   `-- SplashRings.tsx
|   |-- AtlasPanel.tsx
|   |-- BottomNav.tsx
|   |-- CelestialSkyView.tsx
|   |-- ClockAmbience.tsx
|   |-- CosmicClockWheel.tsx
|   |-- CosmicNow.tsx
|   |-- DashboardContainer.tsx
|   |-- EmfReader.tsx
|   |-- LaunchScreen.tsx
|   |-- MomentReading.tsx
|   |-- NowStrip.tsx
|   |-- PauloVenturaHub.tsx
|   |-- RingFocusPanel.tsx
|   |-- SensesSpeedDial.tsx
|   |-- sensorArray.css
|   |-- SensorArray.tsx
|   |-- SkyCatalog.tsx
|   |-- SkyCompass.tsx
|   |-- SkyObjectDetailPanel.tsx
|   |-- SpacetimeAnchor.tsx
|   |-- SpacetimeReadout.tsx
|   |-- SteampunkWheelRing.tsx
|   `-- WatchMovement.tsx
|-- hooks
|   |-- useClockSfx.ts
|   |-- useCosmicClock.ts
|   |-- useDeviceSensors.ts
|   |-- useLaunchSequence.ts
|   |-- useRealtimeDate.ts
|   |-- useScreenWakeLock.ts
|   |-- useSmoothHeading.ts
|   |-- useSpringMotion.ts
|   `-- useSpringValue.ts
|-- lib
|   |-- cosmic
|   |   |-- aircraftTracking.ts
|   |   |-- airlabs.ts
|   |   |-- astronomy.ts
|   |   |-- celestialBodies.ts
|   |   |-- celestialProjection.ts
|   |   |-- CosmicClockEngine.ts
|   |   |-- geoHorizon.ts
|   |   |-- index.ts
|   |   |-- math.ts
|   |   |-- minorBodies.ts
|   |   |-- pinchGesture.ts
|   |   |-- satelliteTracking.ts
|   |   |-- sensors.ts
|   |   |-- sgp4Simple.ts
|   |   |-- skyHaptics.ts
|   |   |-- skyIcons.ts
|   |   |-- skyWeather.ts
|   |   |-- skyZoom.ts
|   |   `-- types.ts
|   |-- design
|   |   `-- observatoryTokens.ts
|   |-- motion
|   |   `-- spring.ts
|   |-- worldCycles
|   |   |-- calendars
|   |   |   |-- chineseLunisolar.ts
|   |   |   |-- ethiopian.ts
|   |   |   |-- hebrew.ts
|   |   |   |-- hijri.ts
|   |   |   `-- persian.ts
|   |   |-- plugins
|   |   |   |-- chineseLunisolar.ts
|   |   |   |-- chineseYear.ts
|   |   |   |-- ethiopian.ts
|   |   |   |-- galactic1320.ts
|   |   |   |-- gregorian.ts
|   |   |   |-- hebrew.ts
|   |   |   |-- hijri.ts
|   |   |   |-- lunar.ts
|   |   |   |-- persian.ts
|   |   |   |-- tropical.ts
|   |   |   `-- tzolkin.ts
|   |   |-- clockAdapter.ts
|   |   |-- context.ts
|   |   |-- index.ts
|   |   |-- multiVoice.ts
|   |   |-- preferences.ts
|   |   |-- presets.ts
|   |   |-- registry.ts
|   |   |-- resolveWorldCycles.ts
|   |   |-- snapshotBridge.ts
|   |   |-- types.ts
|   |   `-- worldCycles.golden.test.ts
|   |-- clockSfx.ts
|   |-- constellationLines.ts
|   |-- cosmicAssets.ts
|   |-- cosmicGraphicIcons.tsx
|   |-- cycleSystems.ts
|   |-- deepSkyCatalog.ts
|   |-- deviceAttitude.test.ts
|   |-- deviceAttitude.ts
|   |-- deviceOrientation.ts
|   |-- deviceSensors.ts
|   |-- emfField.ts
|   |-- galacticFrequency.ts
|   |-- localSignals.ts
|   |-- magneticDeclination.ts
|   |-- nearestStars.ts
|   |-- orientationCalibration.test.ts
|   |-- orientationCalibration.ts
|   |-- platform.ts
|   |-- researchEngine.ts
|   |-- sensorSmoothing.ts
|   |-- site.ts
|   |-- skyPositions.ts
|   |-- spacetime.ts
|   |-- spacetimeReference.ts
|   |-- speedDialTiers.ts
|   |-- sphericalView.horizon.test.ts
|   |-- sphericalView.ts
|   |-- starmap.ts
|   |-- synthesisFromSnapshot.ts
|   |-- timeEngine.ts
|   `-- zodiacArt.ts
|-- public
|   |-- delphi-brand-reference.png
|   |-- file.svg
|   |-- globe.svg
|   |-- icon.svg
|   |-- manifest.webmanifest
|   |-- next.svg
|   |-- vercel.svg
|   `-- window.svg
|-- scripts
|   `-- check-calendars.ts
|-- services
|   |-- astronomyEngine.ts
|   |-- synthesisEngine.ts
|   `-- weatherService.ts
|-- store
|-- types
|   `-- cosmos.ts
|-- .gitignore
|-- .nvmrc
|-- AGENTS.md
|-- CLAUDE.md
|-- eslint.config.mjs
|-- next.config.ts
|-- next-env.d.ts
|-- package.json
|-- package-lock.json
|-- postcss.config.mjs
|-- README.md
|-- tsconfig.json
|-- tsconfig.tsbuildinfo
|-- vercel.json
`-- vitest.config.ts
```

## `package.json`

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=20.9.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "astronomy-engine": "^2.1.19",
    "axios": "^1.18.0",
    "framer-motion": "^12.42.0",
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3.2.4"
  }
}
```

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```
