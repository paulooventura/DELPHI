import Foundation

// MARK: - Bundled defaults + deterministic mock generator

public enum TelemetryMock {
    /// Representative active LEO objects (ISS + Starlink sample + Hubble). Refreshed live via CelesTrak.
    public static let defaultCatalog: [TLERecord] = [
        TLERecord(
            name: "ISS (ZARYA)",
            line1: "1 25544U 98067A   25170.54861111  .00016717  00000+0  10270-3 0  9991",
            line2: "2 25544  51.6416 247.9367 0006703 130.5360 229.6035 15.49815379 94521"),
        TLERecord(
            name: "STARLINK-1421",
            line1: "1 46287U 20074B   25170.41666667  .00001234  00000+0  10456-4 0  9993",
            line2: "2 46287  53.0541 180.2345 0001456  88.4321 271.7123 15.06345678 12345"),
        TLERecord(
            name: "STARLINK-1422",
            line1: "1 46288U 20074C   25170.41666667  .00001256  00000+0  10478-4 0  9994",
            line2: "2 46288  53.0543 180.5678 0001467  89.1234 270.9876 15.06356789 12346"),
        TLERecord(
            name: "STARLINK-1423",
            line1: "1 46289U 20074D   25170.41666667  .00001278  00000+0  10500-4 0  9995",
            line2: "2 46289  53.0545 180.8901 0001478  90.2345 270.1234 15.06367890 12347"),
        TLERecord(
            name: "HUBBLE",
            line1: "1 20580U 90037B   25170.50000000  .00000123  00000+0  12345-4 0  9992",
            line2: "2 20580  28.4697 120.3456 0002789  45.6789 314.4321 15.09876543 54321"),
    ]

    private struct MockFlight { let cs: String; let alt: Double; let hdg: Double; let gs: Double }

    private static let flights: [MockFlight] = [
        .init(cs: "UAL901", alt: 35000, hdg: 270, gs: 460),
        .init(cs: "DAL412", alt: 38000, hdg: 90, gs: 480),
        .init(cs: "SWA1847", alt: 33000, hdg: 180, gs: 420),
        .init(cs: "AAL220", alt: 36000, hdg: 45, gs: 450),
        .init(cs: "FDX88", alt: 39000, hdg: 315, gs: 490),
        .init(cs: "BAW117", alt: 37000, hdg: 135, gs: 470),
        .init(cs: "JBU523", alt: 34000, hdg: 225, gs: 430),
        .init(cs: "NKS301", alt: 32000, hdg: 0, gs: 410),
    ]

    /// Deterministic traffic around the observer for demo / offline mode.
    public static func aircraft(observer: GeoPosition, seed: Int = 0, count: Int = 6) -> [AircraftReport] {
        let baseLat = observer.latDeg
        let baseLon = observer.lonDeg
        let n = min(count, flights.count)
        var reports: [AircraftReport] = []
        for i in 0..<n {
            let f = flights[i]
            let angle = Double((seed + i * 47) % 360) * (Double.pi / 180)
            let distDeg = 0.4 + Double(i).truncatingRemainder(dividingBy: 8) * 0.15
            let latDeg = baseLat + distDeg * cos(angle)
            let lonDeg = baseLon + distDeg * sin(angle) / cos(baseLat * Double.pi / 180)
            let hex = String(format: "a%05x", seed + i)
            reports.append(AircraftReport(
                icao24: hex, callsign: f.cs, latDeg: latDeg, lonDeg: lonDeg,
                baroAltFt: f.alt, headingDeg: f.hdg, gsKnots: f.gs,
                verticalRateFpm: 0
            ))
        }
        return reports
    }
}

// MARK: - ADS-B response parsers

/// AirLabs v9 `flights` response.
public enum AirLabsParser {
    private struct Root: Decodable { let response: [Row]? }
    private struct Row: Decodable {
        let hex: String?
        let flight_iata: String?
        let lat: Double?
        let lng: Double?
        let alt: Double?
        let dir: Double?
        let speed: Double?
    }

    public static func parse(_ data: Data) throws -> [AircraftReport] {
        guard let root = try? JSONDecoder().decode(Root.self, from: data) else { throw TelemetryError.decode }
        return (root.response ?? []).compactMap { row in
            guard let lat = row.lat, let lon = row.lng else { return nil }
            return AircraftReport(
                icao24: row.hex ?? "unknown",
                callsign: row.flight_iata ?? row.hex ?? "UNKN",
                latDeg: lat, lonDeg: lon,
                baroAltFt: row.alt ?? 30000,
                headingDeg: row.dir ?? 0,
                gsKnots: row.speed ?? 400
            )
        }
    }
}

/// Aviationstack `flights` response.
public enum AviationstackParser {
    private struct Root: Decodable { let data: [Row]? }
    private struct Row: Decodable {
        struct Flight: Decodable { let iata: String?; let icao: String?; let number: String? }
        struct Aircraft: Decodable { let icao24: String? }
        struct Geo: Decodable {
            let latitude: Double?; let longitude: Double?; let altitude: Double?
            let direction: Double?; let speed: Double?
        }
        let flight: Flight?
        let aircraft: Aircraft?
        let geography: Geo?
        let live: Geo?
    }

    public static func parse(_ data: Data) throws -> [AircraftReport] {
        guard let root = try? JSONDecoder().decode(Root.self, from: data) else { throw TelemetryError.decode }
        return (root.data ?? []).compactMap { row in
            let geo = row.live ?? row.geography
            guard let lat = geo?.latitude, let lon = geo?.longitude else { return nil }
            let cs = row.flight?.icao ?? row.flight?.iata ?? row.flight?.number ?? "UNKN"
            return AircraftReport(
                icao24: row.aircraft?.icao24 ?? cs.lowercased(),
                callsign: cs,
                latDeg: lat, lonDeg: lon,
                baroAltFt: geo?.altitude ?? 30000,
                headingDeg: geo?.direction ?? 0,
                gsKnots: geo?.speed ?? 400
            )
        }
    }
}
