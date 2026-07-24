import Foundation

// MARK: - Spatial value types

/// Geodetic position (WGS-84). Altitude is metres above the ellipsoid.
public struct GeoPosition: Sendable, Equatable {
    public var latDeg: Double
    public var lonDeg: Double
    public var altM: Double

    public init(latDeg: Double, lonDeg: Double, altM: Double = 0) {
        self.latDeg = latDeg
        self.lonDeg = lonDeg
        self.altM = altM
    }
}

/// Local horizontal frame. Azimuth: 0° = north, 90° = east. Altitude: 0° = horizon, 90° = zenith.
public struct HorizontalCoords: Sendable, Equatable {
    public var az: Double
    public var alt: Double
    /// Straight-line (slant) range to the target in metres.
    public var rangeM: Double
    /// Great-circle distance over the surface in metres.
    public var surfaceDistanceM: Double

    public init(az: Double, alt: Double, rangeM: Double = 0, surfaceDistanceM: Double = 0) {
        self.az = az
        self.alt = alt
        self.rangeM = rangeM
        self.surfaceDistanceM = surfaceDistanceM
    }
}

public struct EcefVector: Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var z: Double
}

/// Equatorial coordinates as used by the deep-space catalog.
public struct EquatorialCoords: Sendable, Equatable {
    public var raHours: Double
    public var decDeg: Double
}

/// Sub-satellite geodetic point produced by orbital propagation.
public struct GeodeticState: Sendable, Equatable {
    public var latDeg: Double
    public var lonDeg: Double
    public var altKm: Double
}

/// Orbital elements parsed from a Two-Line Element set.
public struct ParsedTLE: Sendable, Equatable {
    public var name: String
    public var noradId: Int
    public var inclinationDeg: Double
    public var raanDeg: Double
    public var eccentricity: Double
    public var argPerigeeDeg: Double
    public var meanAnomalyDeg: Double
    public var meanMotionRevPerDay: Double
    public var epoch: Date
    public var bstar: Double
}

/// Rate of change of a horizon position, used for smoothing / lead indicators.
public struct HorizonRate: Sendable, Equatable {
    public var azRate: Double
    public var altRate: Double
    public var sepRate: Double
}

// MARK: - The mathematical kernel

/// Pure, side-effect-free transforms between deep-space (RA/Dec), low-earth-orbit (TLE)
/// and atmospheric (ADS-B lat/lon/alt) systems into the device's local horizon frame.
///
/// Ported 1:1 from the web reference implementation in `agent/web/lib/cosmic`
/// (`geoHorizon.ts`, `sgp4Simple.ts`, `celestialBodies.ts`, `starmap.ts`).
public enum CoordinateTransformer {
    static let rad = Double.pi / 180
    static let deg = 180 / Double.pi

    /// WGS-84 ellipsoid.
    static let wgs84A = 6_378_137.0
    static let wgs84E2 = 0.006_694_379_990_14
    private static let earthRadiusKm = 6_378.137
    private static let earthF2 = 0.006_694_38

    /// Standard gravitational parameter (km³/s²).
    private static let mu = 398_600.4418
    /// Earth rotation rate (rad/s).
    private static let earthOmega = 7.292_115e-5
    private static let minutesPerDay = 1_440.0

    // MARK: Common helpers

    public static func normalizeDeg(_ deg: Double) -> Double {
        var d = deg.truncatingRemainder(dividingBy: 360)
        if d < 0 { d += 360 }
        return d
    }

    public static func julianDay(_ date: Date) -> Double {
        date.timeIntervalSince1970 / 86_400.0 + 2_440_587.5
    }

    private static func julianCentury(_ jd: Double) -> Double {
        (jd - 2_451_545.0) / 36_525.0
    }

    /// Angular separation between two horizon points (degrees).
    public static func angularSeparationDeg(az1: Double, alt1: Double, az2: Double, alt2: Double) -> Double {
        let a1 = alt1 * rad
        let a2 = alt2 * rad
        let dAz = (az2 - az1) * rad
        let cosD = sin(a1) * sin(a2) + cos(a1) * cos(a2) * cos(dAz)
        return acos(max(-1, min(1, cosD))) * deg
    }

    /// Angular distance from the view centre (heading/pitch) to a target — used for target-lock.
    public static func separationFromCenter(headingDeg: Double, pitchDeg: Double, az: Double, alt: Double) -> Double {
        angularSeparationDeg(az1: headingDeg, alt1: pitchDeg, az2: az, alt2: alt)
    }

    // MARK: 1. Atmospheric (ADS-B) — geodetic → horizon

    /// Geodetic → Earth-Centered Earth-Fixed (metres).
    public static func geoToEcef(latDeg: Double, lonDeg: Double, altM: Double) -> EcefVector {
        let lat = latDeg * rad
        let lon = lonDeg * rad
        let sinLat = sin(lat), cosLat = cos(lat)
        let sinLon = sin(lon), cosLon = cos(lon)
        let n = wgs84A / (1 - wgs84E2 * sinLat * sinLat).squareRoot()
        return EcefVector(
            x: (n + altM) * cosLat * cosLon,
            y: (n + altM) * cosLat * sinLon,
            z: (n * (1 - wgs84E2) + altM) * sinLat
        )
    }

    /// ECEF difference vector → local East-North-Up at the observer.
    public static func ecefToEnu(dx: Double, dy: Double, dz: Double, observerLatDeg: Double, observerLonDeg: Double) -> (e: Double, n: Double, u: Double) {
        let lat = observerLatDeg * rad
        let lon = observerLonDeg * rad
        let sinLat = sin(lat), cosLat = cos(lat)
        let sinLon = sin(lon), cosLon = cos(lon)
        return (
            e: -sinLon * dx + cosLon * dy,
            n: -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz,
            u: cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz
        )
    }

    /// Haversine surface distance between two geodetic points (metres).
    public static func surfaceDistanceM(lat1Deg: Double, lon1Deg: Double, lat2Deg: Double, lon2Deg: Double) -> Double {
        let lat1 = lat1Deg * rad
        let lat2 = lat2Deg * rad
        let dLat = (lat2Deg - lat1Deg) * rad
        let dLon = (lon2Deg - lon1Deg) * rad
        let a = pow(sin(dLat / 2), 2) + cos(lat1) * cos(lat2) * pow(sin(dLon / 2), 2)
        return 2 * wgs84A * asin(min(1, a.squareRoot()))
    }

    /// Map an aircraft (or any geodetic target) into the observer's local horizontal frame.
    public static func geoToAltAz(observer: GeoPosition, target: GeoPosition) -> HorizontalCoords {
        let obs = geoToEcef(latDeg: observer.latDeg, lonDeg: observer.lonDeg, altM: observer.altM)
        let tgt = geoToEcef(latDeg: target.latDeg, lonDeg: target.lonDeg, altM: target.altM)
        let (e, n, u) = ecefToEnu(dx: tgt.x - obs.x, dy: tgt.y - obs.y, dz: tgt.z - obs.z,
                                  observerLatDeg: observer.latDeg, observerLonDeg: observer.lonDeg)
        let horiz = (e * e + n * n).squareRoot()
        let range = (e * e + n * n + u * u).squareRoot()
        var az = atan2(e, n) * deg
        if az < 0 { az += 360 }
        let alt = atan2(u, horiz) * deg
        return HorizontalCoords(
            az: az,
            alt: alt,
            rangeM: range,
            surfaceDistanceM: surfaceDistanceM(lat1Deg: observer.latDeg, lon1Deg: observer.lonDeg,
                                               lat2Deg: target.latDeg, lon2Deg: target.lonDeg)
        )
    }

    /// Angular rate (deg/min) between two horizon positions over `elapsedMin` minutes.
    public static func horizonAngularRate(from a: HorizontalCoords, to b: HorizontalCoords, elapsedMin: Double) -> HorizonRate {
        guard elapsedMin > 0 else { return HorizonRate(azRate: 0, altRate: 0, sepRate: 0) }
        let dAz = (b.az - a.az + 540).truncatingRemainder(dividingBy: 360) - 180
        let dAlt = b.alt - a.alt
        let azRate = dAz / elapsedMin
        let altRate = dAlt / elapsedMin
        return HorizonRate(azRate: azRate, altRate: altRate, sepRate: (azRate * azRate + altRate * altRate).squareRoot())
    }

    // MARK: 2. Deep space (RA/Dec) — equatorial → horizon

    /// Greenwich Mean Sidereal Time (degrees).
    public static func gmstDeg(_ date: Date) -> Double {
        let jd = julianDay(date)
        let t = julianCentury(jd)
        return normalizeDeg(280.46061837 + 360.98564736629 * (jd - 2_451_545.0) + 0.000387933 * t * t)
    }

    /// Local Sidereal Time (degrees).
    public static func lstDeg(_ date: Date, lonDeg: Double) -> Double {
        normalizeDeg(gmstDeg(date) + lonDeg)
    }

    /// Convert Right Ascension / Declination into the observer's local Az/Alt.
    public static func equatorialToHorizontal(raHours: Double, decDeg: Double, latDeg: Double, lonDeg: Double, date: Date) -> HorizontalCoords {
        let lst = lstDeg(date, lonDeg: lonDeg)
        let latRad = latDeg * rad
        let raDeg = raHours * 15
        let ha = normalizeDeg(lst - raDeg)
        let haRad = ha * rad
        let decRad = decDeg * rad

        let sinAlt = sin(decRad) * sin(latRad) + cos(decRad) * cos(latRad) * cos(haRad)
        let alt = asin(max(-1, min(1, sinAlt))) * deg

        let cosAlt = cos(alt * rad)
        let cosAz = cosAlt < 1e-8 ? 0 : (sin(decRad) - sin(latRad) * sinAlt) / (cos(latRad) * cosAlt)
        var az = acos(max(-1, min(1, cosAz))) * deg
        if sin(haRad) > 0 { az = 360 - az }

        return HorizontalCoords(az: az, alt: alt)
    }

    /// Mean obliquity of the ecliptic (degrees).
    public static func obliquityDeg(_ jd: Double) -> Double {
        let t = julianCentury(jd)
        return 23.4392911111 - 0.0130041667 * t - 0.0000001639 * t * t + 0.0000005036 * t * t * t
    }

    /// Sun apparent ecliptic longitude λ (degrees, tropical).
    public static func sunEclipticLongitudeDeg(_ jd: Double) -> Double {
        let t = julianCentury(jd)
        let l0 = normalizeDeg(280.46646 + 36_000.76983 * t + 0.0003032 * t * t)
        let m = (357.52911 + 35_999.05029 * t - 0.0001537 * t * t) * rad
        let c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m)
            + (0.019993 - 0.000101 * t) * sin(2 * m)
            + 0.000289 * sin(3 * m)
        return normalizeDeg(l0 + c)
    }

    public static func sunEquatorial(_ jd: Double) -> EquatorialCoords {
        let lambda = sunEclipticLongitudeDeg(jd) * rad
        let eps = obliquityDeg(jd) * rad
        let dec = asin(sin(eps) * sin(lambda)) * deg
        let raDeg = normalizeDeg(atan2(cos(eps) * sin(lambda), cos(lambda)) * deg)
        return EquatorialCoords(raHours: raDeg / 15, decDeg: dec)
    }

    /// Ecliptic (λ, β) → equatorial (RA hours, Dec degrees).
    public static func eclipticToEquatorial(lonDeg: Double, latDeg: Double, jd: Double) -> EquatorialCoords {
        let lon = lonDeg * rad
        let lat = latDeg * rad
        let eps = obliquityDeg(jd) * rad
        let sinDec = sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)
        let dec = asin(max(-1, min(1, sinDec))) * deg
        let y = sin(lon) * cos(eps) - tan(lat) * sin(eps)
        let x = cos(lon)
        var raDeg = atan2(y, x) * deg
        if raDeg < 0 { raDeg += 360 }
        return EquatorialCoords(raHours: raDeg / 15, decDeg: dec)
    }

    /// Low-precision geocentric Moon equatorial position.
    public static func moonEquatorial(_ date: Date) -> EquatorialCoords {
        let d = (date.timeIntervalSince1970 - Date(timeIntervalSince1970: 946_728_000).timeIntervalSince1970) / 86_400.0
        let n = (125.1228 - 0.0529538083 * d).truncatingRemainder(dividingBy: 360) * rad
        let m = (134.9634 + 13.0649929509 * d).truncatingRemainder(dividingBy: 360) * rad
        let f = (93.2720 + 13.229350498 * d).truncatingRemainder(dividingBy: 360) * rad
        let moonLong = (n * deg + 6.289 * sin(m)).truncatingRemainder(dividingBy: 360)
        let moonLat = 5.128 * sin(f)
        let eclRad = 23.4393 * rad
        let lonRad = moonLong * rad
        let latRad = moonLat * rad
        let sinDec = sin(latRad) * cos(eclRad) + cos(latRad) * sin(eclRad) * sin(lonRad)
        let dec = asin(max(-1, min(1, sinDec))) * deg
        let y = sin(lonRad) * cos(eclRad) - tan(latRad) * sin(eclRad)
        let x = cos(lonRad)
        var raHours = atan2(y, x) * deg / 15
        if raHours < 0 { raHours += 24 }
        return EquatorialCoords(raHours: raHours, decDeg: dec)
    }

    // MARK: 3. Low Earth Orbit (TLE / simplified SGP4)

    private static func sliceChars(_ s: String, _ from: Int, _ to: Int) -> String {
        let chars = Array(s)
        guard from < chars.count else { return "" }
        return String(chars[from..<min(to, chars.count)])
    }

    private static func parseFloatField(_ s: String) -> Double {
        Double(s.trimmingCharacters(in: .whitespaces)) ?? 0
    }

    /// Decode TLE packed exponent notation, e.g. "10270-3" → 10270e-3 (matches web reference).
    private static func parseExpField(_ s: String) -> Double {
        let t = s.replacingOccurrences(of: " ", with: "")
        guard !t.isEmpty else { return 0 }
        let chars = Array(t)
        if chars.count >= 3 {
            let expSign = chars[chars.count - 2]
            let expDigit = chars[chars.count - 1]
            let mantissa = String(chars[0..<(chars.count - 2)])
            let mantissaBody = mantissa.hasPrefix("+") || mantissa.hasPrefix("-") ? String(mantissa.dropFirst()) : mantissa
            if (expSign == "+" || expSign == "-"), expDigit.isNumber,
               !mantissaBody.isEmpty, mantissaBody.allSatisfy({ $0.isNumber }) {
                return Double("\(mantissa)e\(expSign)\(expDigit)") ?? 0
            }
        }
        return Double(t) ?? 0
    }

    /// Parse a CelesTrak-style TLE pair into Keplerian elements.
    public static func parseTLE(name: String, line1: String, line2: String) -> ParsedTLE {
        let epochYear = Int(sliceChars(line1, 18, 20).trimmingCharacters(in: .whitespaces)) ?? 0
        let epochDay = parseFloatField(sliceChars(line1, 20, 32))
        let fullYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear

        var comps = DateComponents()
        comps.year = fullYear
        comps.month = 1
        comps.day = 1
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let yearStart = cal.date(from: comps) ?? Date(timeIntervalSince1970: 0)
        let epoch = yearStart.addingTimeInterval((epochDay - 1) * 86_400)

        let eccRaw = sliceChars(line2, 26, 33).trimmingCharacters(in: .whitespaces)
        let eccentricity = eccRaw.hasPrefix(".") ? (Double("0" + eccRaw) ?? 0) : parseFloatField(eccRaw)

        return ParsedTLE(
            name: name.trimmingCharacters(in: .whitespaces),
            noradId: Int(sliceChars(line2, 2, 7).trimmingCharacters(in: .whitespaces)) ?? 0,
            inclinationDeg: parseFloatField(sliceChars(line2, 8, 16)),
            raanDeg: parseFloatField(sliceChars(line2, 17, 25)),
            eccentricity: eccentricity,
            argPerigeeDeg: parseFloatField(sliceChars(line2, 34, 42)),
            meanAnomalyDeg: parseFloatField(sliceChars(line2, 43, 51)),
            meanMotionRevPerDay: parseFloatField(sliceChars(line2, 52, 63)),
            epoch: epoch,
            bstar: parseExpField(sliceChars(line1, 53, 61))
        )
    }

    private static func gmstRad(_ date: Date) -> Double {
        gmstDeg(date) * rad
    }

    private static func eciToGeodetic(x: Double, y: Double, z: Double, date: Date) -> GeodeticState {
        let theta = gmstRad(date)
        let xE = x * cos(theta) + y * sin(theta)
        let yE = -x * sin(theta) + y * cos(theta)
        let zE = z
        let lonDeg = atan2(yE, xE) * deg
        let p = (xE * xE + yE * yE).squareRoot()
        var latDeg = atan2(zE, p) * deg
        var altKm = 0.0
        for _ in 0..<4 {
            let lat = latDeg * rad
            let sinLat = sin(lat)
            let n = earthRadiusKm / (1 - earthF2 * sinLat * sinLat).squareRoot()
            altKm = p / cos(lat) - n
            latDeg = atan2(zE, p * (1 - earthF2 * n / (n + altKm))) * deg
        }
        return GeodeticState(latDeg: latDeg, lonDeg: normalizeDeg(lonDeg), altKm: altKm)
    }

    /// Simplified SGP4-class propagation — Keplerian motion plus a secular drag decay term.
    /// Suitable for real-time sky overlays of LEO objects; not for conjunction analysis.
    public static func propagateTLE(_ tle: ParsedTLE, date: Date) -> GeodeticState {
        let dtMin = date.timeIntervalSince(tle.epoch) / 60.0
        let n0 = (tle.meanMotionRevPerDay * 2 * Double.pi) / minutesPerDay
        let a0 = pow(mu / pow(n0 / 60, 2), 1.0 / 3.0)

        let dragFactor = 1 - tle.bstar * dtMin * 1e-4
        let a = a0 * max(0.85, dragFactor)

        let n = (mu / pow(a, 3)).squareRoot() * 60
        let meanAnomaly = (tle.meanAnomalyDeg * rad + n * dtMin).truncatingRemainder(dividingBy: 2 * Double.pi)
        let e = min(0.25, tle.eccentricity)
        var eccAnomaly = meanAnomaly
        for _ in 0..<8 {
            eccAnomaly = meanAnomaly + e * sin(eccAnomaly)
        }
        let nu = 2 * atan2((1 + e).squareRoot() * sin(eccAnomaly / 2), (1 - e).squareRoot() * cos(eccAnomaly / 2))
        let r = a * (1 - e * cos(eccAnomaly))

        let u = nu + tle.argPerigeeDeg * rad
        let i = tle.inclinationDeg * rad
        let raan = tle.raanDeg * rad - earthOmega * (dtMin * 60)

        let xOrb = r * (cos(raan) * cos(u) - sin(raan) * sin(u) * cos(i))
        let yOrb = r * (sin(raan) * cos(u) + cos(raan) * sin(u) * cos(i))
        let zOrb = r * sin(u) * sin(i)

        return eciToGeodetic(x: xOrb, y: yOrb, z: zOrb, date: date)
    }

    /// Sample a recent ground-track for trail rendering (oldest → newest).
    public static func sampleOrbitTrail(_ tle: ParsedTLE, date: Date, steps: Int = 12, stepMin: Double = 2) -> [GeodeticState] {
        var pts: [GeodeticState] = []
        var i = steps
        while i >= 0 {
            let t = date.addingTimeInterval(-Double(i) * stepMin * 60)
            pts.append(propagateTLE(tle, date: t))
            i -= 1
        }
        return pts
    }
}
