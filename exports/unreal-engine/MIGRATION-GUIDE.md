# DELPHI → Unreal Engine 5 Migration Guide

## Architecture map

```
┌─────────────────────────────────────────────────────────────┐
│  DELPHI Web (canonical)          │  UE5 Target              │
├──────────────────────────────────┼──────────────────────────┤
│  astronomy-engine (npm)          │  astronomy C lib / plugin│
│  skyPositions.ts                 │  UDelphiSkyPositions     │
│  celestialBodies.ts              │  UDelphiCelestialBodies  │
│  sphericalView.ts                │  FDelphiSphericalView    │
│  deviceAttitude.ts               │  FDelphiDeviceAttitude   │
│  orientationCalibration.ts       │  FDelphiOrientationCal   │
│  CelestialSkyView.tsx (canvas)   │  UMG + SceneCapture /    │
│                                  │  Niagara star field      │
│  useCosmicClock.ts (60 Hz)       │  TickGroup TG_PrePhysics │
│  worldCycles/*                   │  DataTable + Blueprint   │
│  galacticFrequency.ts            │  DataTable DT_Galactic260│
│  cosmicAssets.ts                 │  DataTable DT_CosmicArt  │
└──────────────────────────────────┴──────────────────────────┘
```

## Module 1 — Ephemeris (live sky math)

**Source:** `source-reference/web/skyPositions.ts`, `celestialBodies.ts`, `minorBodies.ts`

**UE implementation:**

- Observer: `FVector` geodetic (lat, lon, alt meters) — WGS-84.
- Time: `FDateTime` UTC, convert to TT if using astronomy library directly.
- Output per body: `{ FName Id, float AzDeg, float AltDeg, float Magnitude, FLinearColor }`.

**Bodies (match web IDs):** sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto.

**Tick rate:** Every frame in `ADelphiSkyManager::Tick` — same as web paint loop after Jul 2026 fix.

**C++ sketch:**

```cpp
void ADelphiSkyManager::Tick(float DeltaTime)
{
    const FDateTime Now = FDateTime::UtcNow();
    const FDelphiObserver Obs{ LatitudeDeg, LongitudeDeg, AltitudeM };
    CachedBodies = UDelphiEphemeris::ComputeCelestialBodies(Now, Obs);
    OnBodiesUpdated.Broadcast(CachedBodies);
}
```

## Module 2 — ENU + gnomonic sky window

**Source:** `source-reference/web/sphericalView.ts`

Phone / HMD is a **window** on a fixed celestial sphere anchored at observer GPS.

Key functions to port 1:1:

- `altAzToEnu(az, alt)` → unit vector East-North-Up
- `enuToAltAz(vec)` → horizontal coords
- `deviceOrientationToViewEnu(...)` → camera look direction
- Gnomonic projection: map alt/az to screen UV for HUD overlay

**UE mapping:**

- World space: attach sky sphere to player geodetic anchor (or use `ACesiumGeoreference` if using Cesium).
- Camera forward → convert to ENU → compare against body alt/az for AR lock ring.

## Module 3 — Compass calibration (sun align)

**Source:** `source-reference/web/app/page.tsx` — `calibrateCompassToSun`

Critical rule: use **live view azimuth** from device attitude, NOT raw compass heading (250 ms throttle bug).

```typescript
// Correct (exported)
const viewAz = enuToAltAz(liveAttitudeRef.current.view).az;
const delta = ((sun.az - viewAz + 540) % 360) - 180;
applySkyAzOffset(skyAzOffset + delta);
```

**UE:** Store `UserAzimuthOffsetDeg` on sky manager; sun-align button computes delta from `GetViewAzimuth()` vs computed sun az.

## Module 4 — Cosmic clock & 13:20

**Source:** `galacticFrequency.ts`, `worldCycles/*`, `cosmic/CosmicClockEngine.ts`

**UE:**

- DataTables for 13 Tones + 20 Tribes (260 kin matrix).
- `UDelphiCosmicClockSubsystem` — world subsystem ticking at 60 Hz.
- UMG widget `WBP_CosmicClock` — mechanical watch layout mirrors `WatchMovement.tsx`.

## Module 5 — Visual identity

**Source:** `design-tokens.json`, `cosmicAssets.ts`

Create Material Parameter Collection:

| Parameter | Default |
|---|---|
| `SpaceOuter` | #05070B |
| `SpaceCore` | #0D111A |
| `DayAccent` | #60A5FA |
| `NightGold` | #F59E0B |
| `TargetLock` | #10B981 |
| `HorizonLine` | rgba 255,255,255,0.22 |

Font: **Cinzel** (Google Fonts) — import to `Content/Delphi/Fonts/`.

## Module 6 — Sensors (optional AR)

| Web | UE5 |
|---|---|
| Geolocation API | Android/iOS location plugin or manual lat/lon |
| DeviceOrientation | IMU on mobile / HMD orientation |
| Magnetometer + declination | `magneticDeclination.ts` → NOAA WMM lookup table |

Smoothing: port `sensorSmoothing.ts` `OrientationFilter` + `GeoFixFilter` as exponential moving averages.

## Suggested UE folder layout

```
DelphiCosmos/
├── DelphiCosmos.uproject
├── Content/
│   └── Delphi/
│       ├── Blueprints/BP_DelphiSkyManager
│       ├── Blueprints/BP_CosmicClockPawn
│       ├── Materials/MPC_Observatory
│       ├── Textures/T_DelphiBrand
│       ├── Textures/T_13x20Plate
│       ├── UI/WBP_SkyHUD
│       └── Data/
│           ├── DT_Galactic260
│           └── DT_CelestialBodies
└── Source/
    └── DelphiCosmos/
        ├── DelphiCosmos.Build.cs
        └── Celestial/
            ├── DelphiEphemeris.h/.cpp
            ├── DelphiSphericalView.h/.cpp
            └── DelphiOrientationCal.h/.cpp
```

## iOS Swift reference

Files in `source-reference/ios/` are annotated **"Ported 1:1 from web"** — use as C++ pseudocode when TypeScript and Blueprints disagree.

Priority: `CoordinateTransformer.swift`, `CelestialBodies.swift`, `CosmicClockEngine.swift`.

## Testing parity

Run web vitest before trusting UE port:

```bash
cd agent/web && npm test
```

Golden tests: `deviceAttitude.test.ts`, `orientationCalibration.test.ts`, `sphericalView.horizon.test.ts`.

Add UE automation tests with fixed observer (Nashville: 36.1627, -86.7816) + fixed UTC instant; assert sun az/alt within 0.1° of web output.

## Phase plan

| Phase | Deliverable | Est. |
|---|---|---|
| 0 | This export pack + zip | Done |
| 1 | UE project + ephemeris plugin, sun/moon on HUD | 1–2 days |
| 2 | Full planetarium + gnomonic AR view | 2–3 days |
| 3 | Cosmic clock UMG + 13:20 data | 2 days |
| 4 | World calendars DataTables | 3–5 days |
| 5 | Cesium georeference / outdoor AR | optional |

## Dependencies (web → UE)

| Web npm | UE equivalent |
|---|---|
| astronomy-engine | cosinekitty/astronomy (C) |
| satellite.js | Custom TLE parser (see sgp4Simple.ts) |
| — | Cesium for Unreal (optional globe) |

---

*Generated from DELPHI repo. SkyMap live-math + sun-calibration fixes included in source-reference copies.*
