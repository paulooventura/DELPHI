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

## Open in Xcode

1. File → Open → select `Package.swift` for the library only, **or**
2. Create a new iOS App in Xcode, add `CosmicClock` as a local Swift Package dependency, paste `CosmicClockApp.swift` into the app target.

## Parity with web

| Web | Swift |
|-----|-------|
| `lib/cosmic/math.ts` | `CosmicMath` |
| `CosmicClockEngine.ts` | `CosmicClockEngine` |
| `useCosmicClock` hook | `CosmicClockViewModel` + 60 Hz `Timer` |
| SVG rings | SwiftUI `Canvas` (extend with CoreMotion, CMAltimeter, CoreLocation) |

## Next native steps

- `CLLocationManager` → GPS solar noon / twilight (port `astronomy.ts`)
- `CMAltimeter` → barometric breath ring
- `UIScreen` brightness proxy until ambient light API is available
- Ring tap → focus animation with `withAnimation` + scale

Web reference: `agent/web/lib/cosmic/`
