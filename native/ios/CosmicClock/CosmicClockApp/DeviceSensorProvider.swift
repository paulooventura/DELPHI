import Foundation
import Combine
import CoreLocation
import CosmicClock
#if os(iOS)
import CoreMotion
#endif

/// Bridges real device sensors into the sky view:
/// - `CoreLocation` supplies the observer's GPS position (lat/lon/ellipsoidal altitude).
/// - `CoreMotion` device-motion attitude (true-north reference frame) supplies the live
///   look direction — azimuth (heading) and altitude (pitch) of the back camera ray.
///
/// All `@Published` mutations are delivered on the main thread so SwiftUI and the
/// `@MainActor` view model can read them without data races.
///
/// Requires Info.plist keys: `NSLocationWhenInUseUsageDescription`, `NSMotionUsageDescription`.
final class DeviceSensorProvider: NSObject, ObservableObject {
    /// Latest GPS fix, or `nil` until the first location update arrives.
    @Published private(set) var observer: GeoPosition?
    /// Look azimuth, degrees, 0° = true north, increasing clockwise.
    @Published private(set) var headingDeg: Double = 0
    /// Look altitude, degrees, 0° = horizon, +90° = zenith.
    @Published private(set) var pitchDeg: Double = 0
    @Published private(set) var authorization: CLAuthorizationStatus = .notDetermined
    @Published private(set) var isMotionActive = false
    @Published private(set) var hasFix = false

    private let location = CLLocationManager()
    #if os(iOS)
    private let motion = CMMotionManager()
    private let motionQueue = OperationQueue()
    #endif

    override init() {
        super.init()
        location.delegate = self
        location.desiredAccuracy = kCLLocationAccuracyBest
        location.distanceFilter = 50
    }

    func start() {
        location.requestWhenInUseAuthorization()
        location.startUpdatingLocation()
        #if os(iOS)
        location.headingOrientation = .portrait
        if CLLocationManager.headingAvailable() { location.startUpdatingHeading() }
        startMotion()
        #endif
    }

    func stop() {
        location.stopUpdatingLocation()
        #if os(iOS)
        location.stopUpdatingHeading()
        motion.stopDeviceMotionUpdates()
        #endif
        isMotionActive = false
    }

    // MARK: Motion → heading/pitch

    #if os(iOS)
    private func startMotion() {
        guard motion.isDeviceMotionAvailable else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 30.0
        let available = CMMotionManager.availableAttitudeReferenceFrames()
        let frame: CMAttitudeReferenceFrame = available.contains(.xTrueNorthZVertical)
            ? .xTrueNorthZVertical
            : .xMagneticNorthZVertical
        motionQueue.maxConcurrentOperationCount = 1
        motion.startDeviceMotionUpdates(using: frame, to: motionQueue) { [weak self] dm, _ in
            guard let self, let dm else { return }
            let look = Self.pointing(from: dm.attitude.rotationMatrix)
            DispatchQueue.main.async {
                self.headingDeg = look.az
                self.pitchDeg = look.alt
                if !self.isMotionActive { self.isMotionActive = true }
            }
        }
    }

    /// Map the device attitude to the back-camera (device −Z) pointing ray in a
    /// true-north / vertical reference frame, then to (azimuth, altitude).
    ///
    /// Reference frame axes: X = north, Y = west, Z = up.
    /// world = R · (0,0,−1) = (−m13, −m23, −m33) = (north, west, up).
    static func pointing(from m: CMRotationMatrix) -> (az: Double, alt: Double) {
        let north = -m.m13
        let west = -m.m23
        let up = -m.m33
        let deg = 180.0 / Double.pi
        let alt = asin(max(-1, min(1, up))) * deg
        // east = −west; azimuth measured clockwise from north toward east.
        var az = atan2(-west, north) * deg
        if az < 0 { az += 360 }
        return (az, alt)
    }
    #endif
}

extension DeviceSensorProvider: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedWhenInUse || authorization == .authorizedAlways {
            manager.startUpdatingLocation()
            #if os(iOS)
            if CLLocationManager.headingAvailable() { manager.startUpdatingHeading() }
            #endif
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        observer = GeoPosition(latDeg: loc.coordinate.latitude,
                               lonDeg: loc.coordinate.longitude,
                               altM: loc.altitude)
        hasFix = true
    }

    #if os(iOS)
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        // Compass fallback for the azimuth only while CoreMotion attitude is unavailable.
        guard !isMotionActive, newHeading.headingAccuracy >= 0 else { return }
        let h = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        headingDeg = h
    }
    #endif

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Keep the last good fix; the view model falls back to its default observer.
    }
}
