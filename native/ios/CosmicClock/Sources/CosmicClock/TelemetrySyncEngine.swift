import Foundation
import Combine

// MARK: - Telemetry domain models

/// A single ADS-B aircraft report (raw, geodetic).
public struct AircraftReport: Sendable, Identifiable, Equatable {
    public var icao24: String
    public var callsign: String
    public var latDeg: Double
    public var lonDeg: Double
    public var baroAltFt: Double
    public var headingDeg: Double
    public var gsKnots: Double
    public var verticalRateFpm: Double?

    public var id: String { icao24 }

    public init(icao24: String, callsign: String, latDeg: Double, lonDeg: Double,
                baroAltFt: Double, headingDeg: Double, gsKnots: Double, verticalRateFpm: Double? = nil) {
        self.icao24 = icao24
        self.callsign = callsign
        self.latDeg = latDeg
        self.lonDeg = lonDeg
        self.baroAltFt = baroAltFt
        self.headingDeg = headingDeg
        self.gsKnots = gsKnots
        self.verticalRateFpm = verticalRateFpm
    }
}

/// An aircraft projected into the observer's local horizon frame.
public struct AircraftTrack: Sendable, Identifiable, Equatable {
    public var id: String
    public var callsign: String
    public var az: Double
    public var alt: Double
    public var rangeM: Double
    public var baroAltFt: Double
    public var headingDeg: Double
    public var gsKnots: Double
}

/// A satellite projected into the observer's local horizon frame.
public struct SatelliteTrack: Sendable, Identifiable, Equatable {
    public var id: String
    public var name: String
    public var noradId: Int
    public var az: Double
    public var alt: Double
    public var rangeM: Double
    public var latDeg: Double
    public var lonDeg: Double
    public var altKm: Double
    public var trail: [HorizonPoint]
}

public struct HorizonPoint: Sendable, Equatable {
    public var az: Double
    public var alt: Double
}

/// Raw three-line record (name + the two element lines).
public struct TLERecord: Sendable, Equatable {
    public var name: String
    public var line1: String
    public var line2: String

    public init(name: String, line1: String, line2: String) {
        self.name = name
        self.line1 = line1
        self.line2 = line2
    }
}

/// Geographic bounding box for local-airspace polling.
public struct BoundingBox: Sendable, Equatable {
    public var minLat: Double
    public var maxLat: Double
    public var minLon: Double
    public var maxLon: Double
}

// MARK: - Aircraft feed abstraction (mockable)

/// Transponder client interface. Concrete feeds wrap OpenSky / AirLabs / Aviationstack,
/// or the deterministic mock for offline / demo mode.
public protocol AircraftFeed: Sendable {
    func fetch(box: BoundingBox, observer: GeoPosition) async throws -> [AircraftReport]
}

/// Deterministic mock traffic around the observer — no network required.
public struct MockAircraftFeed: AircraftFeed {
    public var count: Int
    public init(count: Int = 6) { self.count = count }

    public func fetch(box: BoundingBox, observer: GeoPosition) async throws -> [AircraftReport] {
        let seed = Int(Date().timeIntervalSince1970 / 60)
        return TelemetryMock.aircraft(observer: observer, seed: seed, count: count)
    }
}

/// AirLabs v9 `flights` integration. Falls back to the mock feed if no key is supplied.
public struct AirLabsAircraftFeed: AircraftFeed {
    public var apiKey: String
    public var radiusKm: Int
    private let session: URLSession

    public init(apiKey: String, radiusKm: Int = 250, session: URLSession = .shared) {
        self.apiKey = apiKey
        self.radiusKm = radiusKm
        self.session = session
    }

    public func fetch(box: BoundingBox, observer: GeoPosition) async throws -> [AircraftReport] {
        var comps = URLComponents(string: "https://airlabs.co/api/v9/flights")!
        comps.queryItems = [
            .init(name: "api_key", value: apiKey),
            .init(name: "lat", value: String(observer.latDeg)),
            .init(name: "lng", value: String(observer.lonDeg)),
            .init(name: "distance", value: String(radiusKm)),
        ]
        let (data, response) = try await session.data(from: comps.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw TelemetryError.http((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try AirLabsParser.parse(data)
    }
}

/// Aviationstack `flights` integration.
public struct AviationstackAircraftFeed: AircraftFeed {
    public var apiKey: String
    public var limit: Int
    private let session: URLSession

    public init(apiKey: String, limit: Int = 20, session: URLSession = .shared) {
        self.apiKey = apiKey
        self.limit = limit
        self.session = session
    }

    public func fetch(box: BoundingBox, observer: GeoPosition) async throws -> [AircraftReport] {
        var comps = URLComponents(string: "https://api.aviationstack.com/v1/flights")!
        comps.queryItems = [
            .init(name: "access_key", value: apiKey),
            .init(name: "limit", value: String(limit)),
        ]
        let (data, response) = try await session.data(from: comps.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw TelemetryError.http((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try AviationstackParser.parse(data)
    }
}

public enum TelemetryError: Error, Sendable {
    case http(Int)
    case decode
}

// MARK: - Satellite catalog provider

/// Supplies TLE elements — bundled defaults, or live CelesTrak GP JSON.
public struct SatelliteCatalogProvider: Sendable {
    public var useLive: Bool
    private let session: URLSession

    public init(useLive: Bool = false, session: URLSession = .shared) {
        self.useLive = useLive
        self.session = session
    }

    public func resolve() async -> [ParsedTLE] {
        if useLive {
            async let stations = fetchGroup("stations")
            async let starlink = fetchGroup("starlink")
            let stationRecords = (try? await stations) ?? []
            let starlinkRecords = Array(((try? await starlink) ?? []).prefix(8))
            let merged = stationRecords + starlinkRecords
            if !merged.isEmpty {
                return merged.map { CoordinateTransformer.parseTLE(name: $0.name, line1: $0.line1, line2: $0.line2) }
            }
        }
        return TelemetryMock.defaultCatalog.map {
            CoordinateTransformer.parseTLE(name: $0.name, line1: $0.line1, line2: $0.line2)
        }
    }

    private func fetchGroup(_ group: String) async throws -> [TLERecord] {
        var comps = URLComponents(string: "https://celestrak.org/NORAD/elements/gp.php")!
        comps.queryItems = [.init(name: "GROUP", value: group), .init(name: "FORMAT", value: "json")]
        let (data, response) = try await session.data(from: comps.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw TelemetryError.http((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        struct GP: Decodable { let OBJECT_NAME: String; let TLE_LINE1: String; let TLE_LINE2: String }
        let rows = try JSONDecoder().decode([GP].self, from: data)
        return rows.prefix(40).map { TLERecord(name: $0.OBJECT_NAME, line1: $0.TLE_LINE1, line2: $0.TLE_LINE2) }
    }
}

// MARK: - Thread-safe UI state object (Main thread only)

/// Observable snapshot consumed by SwiftUI. Mutated only on the main actor;
/// the engine hands it finished, value-typed results so the UI never touches background state.
@MainActor
public final class TelemetryStore: ObservableObject {
    @Published public private(set) var satellites: [SatelliteTrack] = []
    @Published public private(set) var aircraft: [AircraftTrack] = []
    @Published public private(set) var lastSatelliteSync: Date?
    @Published public private(set) var lastAircraftSync: Date?
    @Published public private(set) var isLive = false

    public init() {}

    func apply(satellites: [SatelliteTrack], at date: Date) {
        self.satellites = satellites
        self.lastSatelliteSync = date
    }

    func apply(aircraft: [AircraftTrack], at date: Date) {
        self.aircraft = aircraft
        self.lastAircraftSync = date
    }

    func setLive(_ live: Bool) { isLive = live }
}

// MARK: - The async orchestration actor

/// State-driven background worker. All fetches and coordinate math run on the actor's
/// executor (off main); finished value snapshots are pushed to `TelemetryStore` on the main actor.
public actor TelemetrySyncEngine {
    public struct Config: Sendable {
        public var satelliteIntervalSec: Double
        public var aircraftPollSec: Double
        public var interpolationHz: Double
        public var airspaceRadiusKm: Double

        public init(satelliteIntervalSec: Double = 1.0,
                    aircraftPollSec: Double = 5.0,
                    interpolationHz: Double = 5.0,
                    airspaceRadiusKm: Double = 250) {
            self.satelliteIntervalSec = satelliteIntervalSec
            self.aircraftPollSec = aircraftPollSec
            self.interpolationHz = interpolationHz
            self.airspaceRadiusKm = airspaceRadiusKm
        }
    }

    private let store: TelemetryStore
    private let aircraftFeed: AircraftFeed
    private let catalogProvider: SatelliteCatalogProvider
    private let config: Config

    private var observer: GeoPosition
    private var catalog: [ParsedTLE] = []

    /// Last polled snapshot + the time it was captured, used for dead-reckoning interpolation.
    private var lastReports: [AircraftReport] = []
    private var lastPollAt: Date?

    private var satTask: Task<Void, Never>?
    private var aircraftTask: Task<Void, Never>?
    private var interpTask: Task<Void, Never>?

    public init(observer: GeoPosition,
                store: TelemetryStore,
                aircraftFeed: AircraftFeed = MockAircraftFeed(),
                catalogProvider: SatelliteCatalogProvider = SatelliteCatalogProvider(),
                config: Config = Config()) {
        self.observer = observer
        self.store = store
        self.aircraftFeed = aircraftFeed
        self.catalogProvider = catalogProvider
        self.config = config
    }

    public func updateObserver(_ pos: GeoPosition) {
        observer = pos
    }

    public func start() async {
        catalog = await catalogProvider.resolve()
        let live = !(aircraftFeed is MockAircraftFeed)
        await store.setLive(live)
        startSatelliteLoop()
        startAircraftLoop()
        startInterpolationLoop()
    }

    public func stop() {
        satTask?.cancel(); satTask = nil
        aircraftTask?.cancel(); aircraftTask = nil
        interpTask?.cancel(); interpTask = nil
    }

    // MARK: Satellite propagation at 1 Hz

    private func startSatelliteLoop() {
        satTask?.cancel()
        satTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                await self.propagateSatellites()
                try? await Task.sleep(nanoseconds: await self.nanos(self.config.satelliteIntervalSec))
            }
        }
    }

    private func propagateSatellites() async {
        let now = Date()
        let obs = observer
        let tracks: [SatelliteTrack] = catalog.map { tle in
            let geo = CoordinateTransformer.propagateTLE(tle, date: now)
            let horizon = CoordinateTransformer.geoToAltAz(
                observer: obs,
                target: GeoPosition(latDeg: geo.latDeg, lonDeg: geo.lonDeg, altM: geo.altKm * 1000)
            )
            let trail = CoordinateTransformer.sampleOrbitTrail(tle, date: now, steps: 10, stepMin: 1.5).map { g -> HorizonPoint in
                let h = CoordinateTransformer.geoToAltAz(
                    observer: obs,
                    target: GeoPosition(latDeg: g.latDeg, lonDeg: g.lonDeg, altM: g.altKm * 1000)
                )
                return HorizonPoint(az: h.az, alt: h.alt)
            }
            return SatelliteTrack(
                id: "sat-\(tle.noradId)", name: tle.name, noradId: tle.noradId,
                az: horizon.az, alt: horizon.alt, rangeM: horizon.rangeM,
                latDeg: geo.latDeg, lonDeg: geo.lonDeg, altKm: geo.altKm, trail: trail
            )
        }
        await store.apply(satellites: tracks, at: now)
    }

    // MARK: Aircraft polling every 5 s

    private func startAircraftLoop() {
        aircraftTask?.cancel()
        aircraftTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                await self.pollAircraft()
                try? await Task.sleep(nanoseconds: await self.nanos(self.config.aircraftPollSec))
            }
        }
    }

    private func pollAircraft() async {
        let box = airspaceBox(around: observer, radiusKm: config.airspaceRadiusKm)
        do {
            let reports = try await aircraftFeed.fetch(box: box, observer: observer)
            lastReports = reports
            lastPollAt = Date()
        } catch {
            // Keep last good snapshot; interpolation loop will continue dead-reckoning.
        }
    }

    // MARK: Smooth interpolation between polls (dead reckoning)

    private func startInterpolationLoop() {
        interpTask?.cancel()
        interpTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                await self.emitInterpolatedAircraft()
                try? await Task.sleep(nanoseconds: await self.nanos(1.0 / self.config.interpolationHz))
            }
        }
    }

    private func emitInterpolatedAircraft() async {
        guard let polledAt = lastPollAt else { return }
        let now = Date()
        let dtSec = now.timeIntervalSince(polledAt)
        let obs = observer
        let tracks: [AircraftTrack] = lastReports.map { report in
            let advanced = deadReckon(report, seconds: dtSec)
            let horizon = CoordinateTransformer.geoToAltAz(
                observer: obs,
                target: GeoPosition(latDeg: advanced.latDeg, lonDeg: advanced.lonDeg, altM: advanced.baroAltFt * 0.3048)
            )
            return AircraftTrack(
                id: "ac-\(report.icao24)",
                callsign: report.callsign.isEmpty ? report.icao24.uppercased() : report.callsign,
                az: horizon.az, alt: horizon.alt, rangeM: horizon.rangeM,
                baroAltFt: advanced.baroAltFt, headingDeg: report.headingDeg, gsKnots: report.gsKnots
            )
        }
        await store.apply(aircraft: tracks, at: now)
    }

    /// Project a report forward along its heading/groundspeed to remove inter-poll jumps.
    private func deadReckon(_ r: AircraftReport, seconds: Double) -> AircraftReport {
        guard seconds > 0, r.gsKnots > 0 else { return r }
        let metresPerSec = r.gsKnots * 0.514444
        let distM = metresPerSec * seconds
        let bearing = r.headingDeg * CoordinateTransformer.rad
        let earthR = 6_378_137.0
        let dLat = (distM * cos(bearing)) / earthR
        let dLon = (distM * sin(bearing)) / (earthR * cos(r.latDeg * CoordinateTransformer.rad))
        var out = r
        out.latDeg += dLat * CoordinateTransformer.deg
        out.lonDeg += dLon * CoordinateTransformer.deg
        if let vr = r.verticalRateFpm { out.baroAltFt += vr * (seconds / 60.0) }
        return out
    }

    // MARK: Helpers

    private func nanos(_ seconds: Double) -> UInt64 {
        UInt64(max(0, seconds) * 1_000_000_000)
    }

    /// Bounding box for a great-circle radius around the observer.
    private func airspaceBox(around o: GeoPosition, radiusKm: Double) -> BoundingBox {
        let dLat = radiusKm / 111.0
        let dLon = radiusKm / (111.0 * max(0.01, cos(o.latDeg * CoordinateTransformer.rad)))
        return BoundingBox(minLat: o.latDeg - dLat, maxLat: o.latDeg + dLat,
                           minLon: o.lonDeg - dLon, maxLon: o.lonDeg + dLon)
    }
}
