import Testing
@testable import CosmicClock

@Test func lunarPhaseIsBounded() {
    let f = CosmicMath.lunarPhaseFraction(.now)
    #expect(f >= 0 && f <= 1)
}

@Test func precessionIsSlow() {
    let a = CosmicMath.precessionAngleDeg(.now)
    #expect(a >= 0 && a < 360)
}

@Test func engineProducesLayers() {
    let engine = CosmicClockEngine(latitude: 36.16, longitude: -86.78)
    engine.pressureHpa = 1015
    let layers = engine.tick()
    #expect(layers.count >= 5)
}
