# Cosmic Clock (iOS / SwiftUI)

Native scaffold mirroring the web `CosmicClockEngine`.

## Structure

```
CosmicClock/
  Package.swift              — SwiftPM library (shared math + engine)
  Sources/CosmicClock/
    CosmicClockEngine.swift  — Port of agent/web/lib/cosmic/*
  CosmicClockApp/
    CosmicClockApp.swift     — SwiftUI Canvas preview shell
```

## Build & run the app (XcodeGen)

The app target is defined declaratively in `project.yml` (the `.xcodeproj` is generated, not committed).

```bash
brew install xcodegen          # one-time
cd native/ios/CosmicClock
xcodegen generate              # creates CosmicClock.xcodeproj + Generated-Info.plist
open CosmicClock.xcodeproj
```

Then pick the **CosmicClockApp** scheme and Run.

- The app launches into `CelestialSkyView` (sky canvas) after the splash.
- **AR mode requires a real device** — CoreMotion attitude and GPS are unavailable in the Simulator.
  Use the **AR / MANUAL** toggle in the HUD; the Simulator can still drive MANUAL mode (drag + pinch).
- Required Info.plist keys (`NSLocationWhenInUseUsageDescription`, `NSMotionUsageDescription`) are
  generated from `project.yml`.

### Library only

Open `Package.swift` directly to work on / test the shared `CosmicClock` library in isolation.

## Parity with web

| Web | Swift |
|-----|-------|
| `lib/cosmic/math.ts` | `CosmicMath` |
| `CosmicClockEngine.ts` | `CosmicClockEngine` |
| `useCosmicClock` hook | `CosmicClockViewModel` + 60 Hz `Timer` |
| SVG rings | SwiftUI `Canvas` (extend with CoreMotion, CMAltimeter, CoreLocation) |

## Sky telemetry stack

| File | Role |
|------|------|
| `Sources/CosmicClock/CoordinateTransformer.swift` | Pure math kernel: RA/Dec→Az/Alt, SGP4-class TLE propagation, ADS-B geo→Az/Alt |
| `Sources/CosmicClock/CelestialBodies.swift` | Sun/Moon/planet positions + ecliptic & meridian guides |
| `Sources/CosmicClock/TelemetrySyncEngine.swift` | `actor` orchestration: 1 Hz satellites, 5 s aircraft polling + dead-reckoned interpolation, `@MainActor` store |
| `Sources/CosmicClock/TelemetryFeeds.swift` | Mock / AirLabs / Aviationstack feeds + bundled TLE catalog |
| `CosmicClockApp/CelestialSkyView.swift` | SwiftUI `Canvas`: pinch zoom, level-of-detail, targeting reticle, glassmorphic HUD |
| `CosmicClockApp/DeviceSensorProvider.swift` | CoreLocation GPS + CoreMotion attitude → live heading/pitch/observer |

### Device sensors (AR mode)

`DeviceSensorProvider` feeds real hardware into `CelestialSkyView`:

- **CoreLocation** (`CLLocationManager`) → observer GPS (lat/lon/altitude); also drives the
  true-north reference frame and provides a compass-heading fallback.
- **CoreMotion** (`CMMotionManager`, `.xTrueNorthZVertical` attitude) → the back-camera ray's
  azimuth (heading) and altitude (pitch), so pointing the phone at the sky aims the viewport.

Tap the **AR / MANUAL** toggle in the HUD to switch between sensor-driven and gesture-driven control.
In AR mode, panning is disabled (you move the device) while pinch-zoom still works.

Both frameworks are auto-linked. The app target's **Info.plist must declare**:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Delphi uses your location to place planets, satellites, and aircraft in your local sky.</string>
<key>NSMotionUsageDescription</key>
<string>Delphi uses device motion to aim the sky view where you point your phone.</string>
```

## Next native steps

- `CMAltimeter` → barometric breath ring
- `UIScreen` brightness proxy until ambient light API is available
- Ring tap → focus animation with `withAnimation` + scale

Web reference: `agent/web/lib/cosmic/`
