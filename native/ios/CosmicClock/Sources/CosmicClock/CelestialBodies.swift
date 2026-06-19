import Foundation

public enum CelestialBodyId: String, Sendable, CaseIterable {
    case sun, moon, venus, mars, jupiter, saturn
}

/// A major solar-system body resolved into the observer's horizon frame.
public struct CelestialBody: Sendable, Identifiable, Equatable {
    public let id: CelestialBodyId
    public let name: String
    public let alt: Double
    public let az: Double
    public let raHours: Double
    public let decDeg: Double
    public let magnitude: Double
    /// sRGB hex tint used for the disc / texture fallback.
    public let colorHex: String
    public let major: Bool
}

public enum CelestialCatalog {
    private static let colors: [CelestialBodyId: String] = [
        .sun: "#fff8e8", .moon: "#e8eef8", .venus: "#e8d5a0",
        .mars: "#e07050", .jupiter: "#d4c4a8", .saturn: "#c9b896",
    ]
    private static let mags: [CelestialBodyId: Double] = [
        .sun: -26.7, .moon: -12.6, .venus: -4.2, .mars: 0.5, .jupiter: -2.0, .saturn: 0.8,
    ]

    /// Low-precision geocentric ecliptic longitude/latitude (mean elements, Meeus-style).
    private static func planetEcliptic(_ id: CelestialBodyId, jd: Double) -> (lonDeg: Double, latDeg: Double) {
        let dDays = jd - 2_451_545.0
        let t = dDays / 36_525.0
        let lon: Double
        switch id {
        case .venus: lon = (181.979801 - 0.0000004263 * dDays).truncatingRemainder(dividingBy: 360)
        case .mars: lon = (355.433 + 0.524071 * dDays).truncatingRemainder(dividingBy: 360)
        case .jupiter: lon = (34.351519 + 0.083099 * dDays).truncatingRemainder(dividingBy: 360)
        case .saturn: lon = (50.077444 + 0.033444 * dDays).truncatingRemainder(dividingBy: 360)
        default: lon = 0
        }
        let lonDeg = (lon + 360).truncatingRemainder(dividingBy: 360)
        let latDeg = sin((lonDeg * 0.017 + t) * 2) * 1.2
        return (lonDeg, latDeg)
    }

    /// Major bodies for target-lock and deep-space rendering.
    public static func bodies(date: Date, latDeg: Double, lonDeg: Double) -> [CelestialBody] {
        let jd = CoordinateTransformer.julianDay(date)
        var out: [CelestialBody] = []

        let sun = CoordinateTransformer.sunEquatorial(jd)
        out.append(makeBody(.sun, "Sun", sun, latDeg, lonDeg, date))

        let moon = CoordinateTransformer.moonEquatorial(date)
        out.append(makeBody(.moon, "Moon", moon, latDeg, lonDeg, date))

        for id in [CelestialBodyId.venus, .mars, .jupiter, .saturn] {
            let ecl = planetEcliptic(id, jd: jd)
            let eq = CoordinateTransformer.eclipticToEquatorial(lonDeg: ecl.lonDeg, latDeg: ecl.latDeg, jd: jd)
            out.append(makeBody(id, id.rawValue.capitalized, eq, latDeg, lonDeg, date))
        }
        return out
    }

    private static func makeBody(_ id: CelestialBodyId, _ name: String, _ eq: EquatorialCoords,
                                 _ latDeg: Double, _ lonDeg: Double, _ date: Date) -> CelestialBody {
        let h = CoordinateTransformer.equatorialToHorizontal(raHours: eq.raHours, decDeg: eq.decDeg, latDeg: latDeg, lonDeg: lonDeg, date: date)
        return CelestialBody(
            id: id, name: name, alt: h.alt, az: h.az,
            raHours: eq.raHours, decDeg: eq.decDeg,
            magnitude: mags[id] ?? 2, colorHex: colors[id] ?? "#d5e8ff", major: true
        )
    }

    /// Sample the ecliptic great circle (β = 0) for the guide ring.
    public static func eclipticPath(date: Date, latDeg: Double, lonDeg: Double, stepDeg: Double = 10) -> [HorizonPoint] {
        let jd = CoordinateTransformer.julianDay(date)
        var pts: [HorizonPoint] = []
        var lon = 0.0
        while lon <= 360 {
            let eq = CoordinateTransformer.eclipticToEquatorial(lonDeg: lon, latDeg: 0, jd: jd)
            let h = CoordinateTransformer.equatorialToHorizontal(raHours: eq.raHours, decDeg: eq.decDeg, latDeg: latDeg, lonDeg: lonDeg, date: date)
            pts.append(HorizonPoint(az: h.az, alt: h.alt))
            lon += stepDeg
        }
        return pts
    }

    /// Local meridian arcs (north and south), alt from −89° to +89°.
    public static func meridianArcs() -> [[HorizonPoint]] {
        var north: [HorizonPoint] = []
        var south: [HorizonPoint] = []
        var alt = -89.0
        while alt <= 89 {
            north.append(HorizonPoint(az: 0, alt: alt))
            south.append(HorizonPoint(az: 180, alt: alt))
            alt += 4
        }
        return [north, south]
    }
}
