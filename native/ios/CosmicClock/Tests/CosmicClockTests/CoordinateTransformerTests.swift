import Testing
import Foundation
@testable import CosmicClock

private let observer = GeoPosition(latDeg: 36.1627, lonDeg: -86.7816, altM: 180)

@Test func geoToAltAzAzimuthIsBounded() {
    let north = CoordinateTransformer.geoToAltAz(
        observer: observer,
        target: GeoPosition(latDeg: observer.latDeg + 1, lonDeg: observer.lonDeg, altM: 0)
    )
    #expect(north.az >= 0 && north.az < 360)
    // A target due north should sit near 0°/360° azimuth.
    #expect(north.az < 5 || north.az > 355)
}

@Test func aircraftOverheadHasHighAltitude() {
    let overhead = CoordinateTransformer.geoToAltAz(
        observer: observer,
        target: GeoPosition(latDeg: observer.latDeg, lonDeg: observer.lonDeg, altM: 11_000)
    )
    #expect(overhead.alt > 80)
}

@Test func equatorialToHorizontalProducesValidRange() {
    let h = CoordinateTransformer.equatorialToHorizontal(raHours: 6, decDeg: 20, latDeg: observer.latDeg, lonDeg: observer.lonDeg, date: .now)
    #expect(h.az >= 0 && h.az < 360)
    #expect(h.alt >= -90 && h.alt <= 90)
}

@Test func parseTLEReadsIssElements() {
    let rec = TelemetryMock.defaultCatalog[0]
    let tle = CoordinateTransformer.parseTLE(name: rec.name, line1: rec.line1, line2: rec.line2)
    #expect(tle.noradId == 25544)
    #expect(abs(tle.inclinationDeg - 51.6416) < 0.001)
    #expect(tle.meanMotionRevPerDay > 15 && tle.meanMotionRevPerDay < 16)
}

@Test func propagateTLEProducesLeoAltitude() {
    let rec = TelemetryMock.defaultCatalog[0]
    let tle = CoordinateTransformer.parseTLE(name: rec.name, line1: rec.line1, line2: rec.line2)
    let geo = CoordinateTransformer.propagateTLE(tle, date: tle.epoch)
    // ISS orbits in the ~300–600 km band; the simplified model should land in LEO.
    #expect(geo.altKm > 150 && geo.altKm < 1200)
    #expect(geo.latDeg >= -90 && geo.latDeg <= 90)
}

@Test func angularSeparationIsSymmetric() {
    let a = CoordinateTransformer.angularSeparationDeg(az1: 10, alt1: 20, az2: 40, alt2: 35)
    let b = CoordinateTransformer.angularSeparationDeg(az1: 40, alt1: 35, az2: 10, alt2: 20)
    #expect(abs(a - b) < 1e-9)
    #expect(a > 0)
}

@Test func celestialBodiesIncludeMajorPlanets() {
    let bodies = CelestialCatalog.bodies(date: .now, latDeg: observer.latDeg, lonDeg: observer.lonDeg)
    let ids = Set(bodies.map(\.id))
    #expect(ids.contains(.sun))
    #expect(ids.contains(.jupiter))
    #expect(bodies.count == 6)
}
