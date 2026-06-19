import Foundation

/// Shared astronomical math — ported from `agent/web/lib/cosmic/math.ts`.
public enum CosmicMath {
    public static let synodicMonthDays = 29.530588853
    public static let precessionPeriodYears = 25_772.0
    private static let knownNewMoon = ISO8601DateFormatter().date(from: "2000-01-06T18:14:00Z")!

    public static func julianDay(_ date: Date) -> Double {
        date.timeIntervalSince1970 / 86_400.0 + 2_440_587.5
    }

    public static func normalizeDeg(_ deg: Double) -> Double {
        var d = deg.truncatingRemainder(dividingBy: 360)
        if d < 0 { d += 360 }
        return d
    }

    public static func sunEclipticLongitudeDeg(jd: Double) -> Double {
        let T = (jd - 2_451_545.0) / 36_525.0
        let L0 = normalizeDeg(280.46646 + 36_000.76983 * T)
        let M = (357.52911 + 35_999.05029 * T) * .pi / 180
        let C = (1.914602 - 0.004817 * T) * sin(M)
            + (0.019993 - 0.000101 * T) * sin(2 * M)
            + 0.000289 * sin(3 * M)
        return normalizeDeg(L0 + C)
    }

    public static func lunarPhaseFraction(_ date: Date) -> Double {
        let elapsed = date.timeIntervalSince(knownNewMoon) / 86_400.0
        let mod = elapsed.truncatingRemainder(dividingBy: synodicMonthDays)
        let positive = mod < 0 ? mod + synodicMonthDays : mod
        return positive / synodicMonthDays
    }

    public static func precessionAngleDeg(_ date: Date) -> Double {
        let years = (julianDay(date) - 2_451_545.0) / 365.25
        return normalizeDeg(years / precessionPeriodYears * 360)
    }

    public static func solarDayAngleDeg(now: Date, solarNoon: Date) -> Double {
        let msPerDay = 86_400_000.0
        var offset = now.timeIntervalSince(solarNoon) * 1000
        offset = offset.truncatingRemainder(dividingBy: msPerDay)
        if offset < 0 { offset += msPerDay }
        let fromNoon = offset > msPerDay / 2 ? offset - msPerDay : offset
        return normalizeDeg(fromNoon / msPerDay * 360)
    }
}

public struct SolarDayEvents: Sendable {
    public var solarNoon: Date
    public var sunrise: Date
    public var sunset: Date
}

public struct CycleLayer: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let tier: Int
    public let angleDeg: Double
    public let phase: Double
}

/// Central engine — one `tick` drives all layers (mirrors TypeScript `CosmicClockEngine`).
public final class CosmicClockEngine: @unchecked Sendable {
    public var latitude: Double
    public var longitude: Double
    public var pressureHpa: Double?
    public var lux: Double?

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }

    public func tick(now: Date = .now) -> [CycleLayer] {
        let sunLon = CosmicMath.sunEclipticLongitudeDeg(jd: CosmicMath.julianDay(now))
        let lunar = CosmicMath.lunarPhaseFraction(now)
        let precession = CosmicMath.precessionAngleDeg(now)
        let breath = pressureHpa.map { 0.5 + max(-1, min(1, ($0 - 1013.25) / 25)) * 0.45 } ?? 0.5
        let light = lux.map { min(1, max(0, log10($0 + 1) / 4)) } ?? 0.5

        return [
            CycleLayer(id: "barometric-breath", name: "Atmospheric Breath", tier: 1, angleDeg: breath * 360, phase: breath),
            CycleLayer(id: "light-spectrum", name: "Light Spectrum", tier: 1, angleDeg: light * 360, phase: light),
            CycleLayer(id: "lunar-synodic", name: "Lunar Synodic", tier: 3, angleDeg: lunar * 360, phase: lunar),
            CycleLayer(id: "sun-ecliptic", name: "Solar Season", tier: 5, angleDeg: sunLon, phase: sunLon / 360),
            CycleLayer(id: "precession", name: "Great Year", tier: 6, angleDeg: precession, phase: precession / 360),
        ]
    }
}
