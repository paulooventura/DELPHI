import SwiftUI
import CosmicClock
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Viewport projection + level-of-detail (unified matrix zoom)

/// Scale-dependent gnomonic-ish projection from horizon (az/alt) to screen points.
/// Mirrors `agent/web/lib/cosmic/celestialProjection.ts` + `skyZoom.ts`.
struct SkyViewport {
    var size: CGSize
    var headingDeg: Double
    var pitchDeg: Double
    var scale: Double
    var baseFovAz: Double = 85
    var baseFovAltHalf: Double = 42

    var fovAz: Double { baseFovAz / max(1, scale) }
    var fovAltHalf: Double { baseFovAltHalf / max(1, scale) }

    func project(az: Double, alt: Double) -> CGPoint {
        let dAz = (az - headingDeg + 540).truncatingRemainder(dividingBy: 360) - 180
        let dAlt = alt - pitchDeg
        let x = (dAz / fovAz + 0.5) * size.width
        let y = size.height / 2 - (dAlt / fovAltHalf) * (size.height / 2)
        return CGPoint(x: x, y: y)
    }

    func inView(_ p: CGPoint, pad: CGFloat = 24) -> Bool {
        p.x >= -pad && p.x <= size.width + pad && p.y >= -pad && p.y <= size.height + pad
    }

    // Level of detail thresholds (1×–3× wide field, ≥4× telephoto).
    var detailIsTelephoto: Bool { scale >= 4 }

    /// Opacity of local traffic + star field — fades out as we push into deep-space zoom.
    var localOpacity: Double {
        if scale <= 3 { return 1 }
        return max(0, 1 - min(1, (scale - 3) / 3))
    }

    /// Planet surface/texture blend — fades in past 3×.
    var planetBlend: Double {
        if scale <= 3 { return 0 }
        return min(1, (scale - 3) / 6)
    }

    var clusterSatellites: Bool { scale <= 3 }

    static func formatZoom(_ scale: Double) -> String {
        scale >= 10 ? String(format: "%.0f×", scale) : String(format: "%.1f×", scale)
    }
}

// MARK: - Target lock model

struct DetailRow: Identifiable, Equatable {
    let id = UUID()
    let key: String
    let value: String
}

struct SkyTarget: Identifiable, Equatable {
    enum Kind: String { case planet, satellite, aircraft }
    let id: String
    let kind: Kind
    let label: String
    var az: Double
    var alt: Double
    var detail: [DetailRow]
}

// MARK: - Haptics

@MainActor
final class SkyHaptics {
    #if canImport(UIKit)
    private let impact = UIImpactFeedbackGenerator(style: .rigid)
    private let selection = UISelectionFeedbackGenerator()
    #endif

    func prepare() {
        #if canImport(UIKit)
        impact.prepare(); selection.prepare()
        #endif
    }

    /// Distinct pulse fired when the reticle snaps onto a new target.
    func lockPulse() {
        #if canImport(UIKit)
        impact.impactOccurred(intensity: 1.0)
        impact.prepare()
        #endif
    }

    func tick() {
        #if canImport(UIKit)
        selection.selectionChanged()
        #endif
    }
}

// MARK: - View model — bridges telemetry + zoom state to render-ready data

@MainActor
final class CelestialSkyViewModel: ObservableObject {
    @Published var observer: GeoPosition
    @Published var headingDeg: Double = 180
    @Published var pitchDeg: Double = 28

    /// Smoothed render scale and the user-input target scale.
    @Published var scale: Double = 1
    @Published var targetScale: Double = 1

    @Published var bodies: [CelestialBody] = []
    @Published var lockedTarget: SkyTarget?

    // Mirrored telemetry so the view observes a single object.
    @Published var satellites: [SatelliteTrack] = []
    @Published var aircraft: [AircraftTrack] = []
    @Published var isLive = false

    let store = TelemetryStore()
    private var engine: TelemetrySyncEngine?
    private let haptics = SkyHaptics()
    private var ticker: Timer?

    private let lockEnterDeg = 1.5
    private let lockExitDeg = 3.0

    init(observer: GeoPosition = GeoPosition(latDeg: 36.1627, lonDeg: -86.7816, altM: 180)) {
        self.observer = observer
    }

    func start(aircraftFeed: AircraftFeed = MockAircraftFeed(), useLiveSatellites: Bool = false) {
        haptics.prepare()
        let engine = TelemetrySyncEngine(
            observer: observer,
            store: store,
            aircraftFeed: aircraftFeed,
            catalogProvider: SatelliteCatalogProvider(useLive: useLiveSatellites)
        )
        self.engine = engine
        Task { await engine.start() }

        ticker?.invalidate()
        ticker = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        tick()
    }

    func stop() {
        ticker?.invalidate(); ticker = nil
        let engine = self.engine
        Task { await engine?.stop() }
    }

    func applyZoom(target: Double) {
        targetScale = min(50, max(1, target))
    }

    func pan(deltaX: CGFloat, deltaY: CGFloat, viewport: SkyViewport) {
        headingDeg = CoordinateTransformer.normalizeDeg(headingDeg - Double(deltaX) / viewport.size.width * viewport.fovAz)
        pitchDeg = min(89, max(-20, pitchDeg + Double(deltaY) / viewport.size.height * viewport.fovAltHalf * 2))
    }

    private func tick() {
        // Frictionless scale easing toward the gesture target.
        scale += (targetScale - scale) * 0.28
        if abs(targetScale - scale) < 0.001 { scale = targetScale }

        bodies = CelestialCatalog.bodies(date: Date(), latDeg: observer.latDeg, lonDeg: observer.lonDeg)
        satellites = store.satellites
        aircraft = store.aircraft
        isLive = store.isLive
        updateLock()
    }

    /// Angular proximity check against every visible object (planets, satellites, aircraft).
    private func updateLock() {
        var best: (SkyTarget, Double)?
        func consider(_ target: SkyTarget) {
            let sep = CoordinateTransformer.separationFromCenter(headingDeg: headingDeg, pitchDeg: pitchDeg, az: target.az, alt: target.alt)
            if best == nil || sep < best!.1 { best = (target, sep) }
        }

        for b in bodies where b.alt > -2 { consider(targetForBody(b)) }
        for s in satellites where s.alt > 0 { consider(targetForSatellite(s)) }
        for a in aircraft where a.alt > -2 { consider(targetForAircraft(a)) }

        guard let (candidate, sep) = best else {
            lockedTarget = nil
            return
        }

        if let current = lockedTarget, current.id == candidate.id {
            // Update live data; release only past the hysteresis exit band.
            if sep <= lockExitDeg { lockedTarget = candidate } else { lockedTarget = nil }
        } else if sep <= lockEnterDeg {
            lockedTarget = candidate
            haptics.lockPulse()
        } else if lockedTarget != nil, sep > lockExitDeg {
            lockedTarget = nil
        }
    }

    // MARK: Target builders (real-time data matrices)

    private func targetForBody(_ b: CelestialBody) -> SkyTarget {
        SkyTarget(id: b.id.rawValue, kind: .planet, label: b.name, az: b.az, alt: b.alt, detail: [
            DetailRow(key: "AZ", value: String(format: "%6.2f°", b.az)),
            DetailRow(key: "ALT", value: String(format: "%6.2f°", b.alt)),
            DetailRow(key: "RA", value: String(format: "%5.2fh", b.raHours)),
            DetailRow(key: "DEC", value: String(format: "%6.2f°", b.decDeg)),
            DetailRow(key: "MAG", value: String(format: "%5.1f", b.magnitude)),
        ])
    }

    private func targetForSatellite(_ s: SatelliteTrack) -> SkyTarget {
        SkyTarget(id: s.id, kind: .satellite, label: s.name, az: s.az, alt: s.alt, detail: [
            DetailRow(key: "NORAD", value: String(s.noradId)),
            DetailRow(key: "AZ", value: String(format: "%6.2f°", s.az)),
            DetailRow(key: "ALT", value: String(format: "%6.2f°", s.alt)),
            DetailRow(key: "ALT", value: String(format: "%6.0f km", s.altKm)),
            DetailRow(key: "RANGE", value: String(format: "%6.0f km", s.rangeM / 1000)),
        ])
    }

    private func targetForAircraft(_ a: AircraftTrack) -> SkyTarget {
        SkyTarget(id: a.id, kind: .aircraft, label: a.callsign, az: a.az, alt: a.alt, detail: [
            DetailRow(key: "AZ", value: String(format: "%6.2f°", a.az)),
            DetailRow(key: "ALT", value: String(format: "%6.2f°", a.alt)),
            DetailRow(key: "FL", value: String(format: "%03.0f", a.baroAltFt / 100)),
            DetailRow(key: "HDG", value: String(format: "%5.0f°", a.headingDeg)),
            DetailRow(key: "GS", value: String(format: "%5.0f kt", a.gsKnots)),
            DetailRow(key: "RANGE", value: String(format: "%5.1f km", a.rangeM / 1000)),
        ])
    }
}

// MARK: - The interactive canvas

struct CelestialSkyView: View {
    @StateObject private var model = CelestialSkyViewModel()
    @State private var pinchAnchor: Double = 1
    @State private var lastDrag: CGSize = .zero

    private let neon = Color(red: 0.36, green: 0.96, blue: 0.85)
    private let dim = Color.white.opacity(0.5)

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                Color(red: 0.03, green: 0.045, blue: 0.075).ignoresSafeArea()

                TimelineView(.animation) { _ in
                    Canvas { context, _ in
                        let vp = SkyViewport(size: size, headingDeg: model.headingDeg, pitchDeg: model.pitchDeg, scale: model.scale)
                        drawGuides(context, vp)
                        if vp.localOpacity > 0.01 {
                            drawSatellites(context, vp)
                            drawAircraft(context, vp)
                        }
                        drawBodies(context, vp)
                    }
                }
                .ignoresSafeArea()

                reticle(size: size)
                hud(size: size)
            }
            .contentShape(Rectangle())
            .gesture(magnify(in: size))
            .simultaneousGesture(pan(in: size))
            .onAppear { model.start() }
            .onDisappear { model.stop() }
        }
    }

    // MARK: Gestures

    private func magnify(in size: CGSize) -> some Gesture {
        MagnificationGesture()
            .onChanged { value in
                model.applyZoom(target: pinchAnchor * Double(value))
            }
            .onEnded { _ in
                pinchAnchor = model.targetScale
            }
    }

    private func pan(in size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                let vp = SkyViewport(size: size, headingDeg: model.headingDeg, pitchDeg: model.pitchDeg, scale: model.scale)
                model.pan(deltaX: value.translation.width - lastDrag.width,
                          deltaY: value.translation.height - lastDrag.height,
                          viewport: vp)
                lastDrag = value.translation
            }
            .onEnded { _ in lastDrag = .zero }
    }

    // MARK: Canvas layers

    private func drawGuides(_ context: GraphicsContext, _ vp: SkyViewport) {
        // Ecliptic ring
        var ecliptic = Path()
        var started = false
        for p in CelestialCatalog.eclipticPath(date: Date(), latDeg: model.observer.latDeg, lonDeg: model.observer.lonDeg) {
            let pt = vp.project(az: p.az, alt: p.alt)
            if started { ecliptic.addLine(to: pt) } else { ecliptic.move(to: pt); started = true }
        }
        context.stroke(ecliptic, with: .color(Color(red: 0.95, green: 0.78, blue: 0.4).opacity(0.35)), lineWidth: 0.8)

        // Local meridian arcs
        for arc in CelestialCatalog.meridianArcs() {
            var path = Path()
            var begun = false
            for p in arc {
                let pt = vp.project(az: p.az, alt: p.alt)
                if begun { path.addLine(to: pt) } else { path.move(to: pt); begun = true }
            }
            context.stroke(path, with: .color(.white.opacity(0.16)), lineWidth: 0.7)
        }

        // Horizon line (alt = 0)
        var horizon = Path()
        var h0 = false
        var az = 0.0
        while az <= 360 {
            let pt = vp.project(az: az, alt: 0)
            if h0 { horizon.addLine(to: pt) } else { horizon.move(to: pt); h0 = true }
            az += 6
        }
        context.stroke(horizon, with: .color(neon.opacity(0.28)), lineWidth: 0.8)
    }

    private func drawSatellites(_ context: GraphicsContext, _ vp: SkyViewport) {
        let opacity = vp.localOpacity
        for s in model.satellites where s.alt > 0 {
            let pt = vp.project(az: s.az, alt: s.alt)
            guard vp.inView(pt) else { continue }

            var trail = Path()
            var begun = false
            for tp in s.trail {
                let p = vp.project(az: tp.az, alt: tp.alt)
                if begun { trail.addLine(to: p) } else { trail.move(to: p); begun = true }
            }
            context.stroke(trail, with: .color(.cyan.opacity(0.25 * opacity)), lineWidth: 0.6)

            let r: CGFloat = 2.2
            context.fill(Path(ellipseIn: CGRect(x: pt.x - r, y: pt.y - r, width: r * 2, height: r * 2)),
                         with: .color(.cyan.opacity(0.9 * opacity)))
            if !vp.detailIsTelephoto {
                context.draw(Text(s.name).font(.system(size: 7, design: .monospaced)).foregroundColor(.cyan.opacity(0.7 * opacity)),
                             at: CGPoint(x: pt.x + 6, y: pt.y - 7), anchor: .leading)
            }
        }
    }

    private func drawAircraft(_ context: GraphicsContext, _ vp: SkyViewport) {
        let opacity = vp.localOpacity
        for a in model.aircraft where a.alt > -2 {
            let pt = vp.project(az: a.az, alt: a.alt)
            guard vp.inView(pt) else { continue }

            var icon = Path()
            let s: CGFloat = 4
            icon.move(to: CGPoint(x: pt.x, y: pt.y - s))
            icon.addLine(to: CGPoint(x: pt.x + s, y: pt.y + s))
            icon.addLine(to: CGPoint(x: pt.x, y: pt.y + s * 0.4))
            icon.addLine(to: CGPoint(x: pt.x - s, y: pt.y + s))
            icon.closeSubpath()
            var rotated = icon
            rotated = rotated.applying(CGAffineTransform(translationX: -pt.x, y: -pt.y)
                .concatenating(CGAffineTransform(rotationAngle: a.headingDeg * .pi / 180))
                .concatenating(CGAffineTransform(translationX: pt.x, y: pt.y)))
            context.fill(rotated, with: .color(.white.opacity(0.9 * opacity)))
            context.draw(Text(a.callsign).font(.system(size: 8, weight: .medium, design: .monospaced)).foregroundColor(.white.opacity(0.75 * opacity)),
                         at: CGPoint(x: pt.x + 8, y: pt.y + 1), anchor: .leading)
        }
    }

    private func drawBodies(_ context: GraphicsContext, _ vp: SkyViewport) {
        let blend = vp.planetBlend
        for b in model.bodies where b.alt > -3 {
            let pt = vp.project(az: b.az, alt: b.alt)
            guard vp.inView(pt) else { continue }
            let tint = Color(hex: b.colorHex)

            // Wide field: small dot. Deep zoom: high-fidelity disc filling the viewfinder.
            let baseR: CGFloat = b.id == .sun || b.id == .moon ? 6 : 3
            let zoomR = baseR + CGFloat(blend) * CGFloat(min(vp.scale, 50)) * 4
            let r = baseR + (zoomR - baseR) * CGFloat(blend)

            if blend > 0.02 {
                let glow = Path(ellipseIn: CGRect(x: pt.x - r * 1.6, y: pt.y - r * 1.6, width: r * 3.2, height: r * 3.2))
                context.fill(glow, with: .radialGradient(
                    Gradient(colors: [tint.opacity(0.5 * blend), .clear]),
                    center: pt, startRadius: 0, endRadius: r * 1.6))
            }
            context.fill(Path(ellipseIn: CGRect(x: pt.x - r, y: pt.y - r, width: r * 2, height: r * 2)),
                         with: .color(tint))
            // Saturn ring hint when zoomed.
            if b.id == .saturn, blend > 0.3 {
                var ring = Path()
                ring.addEllipse(in: CGRect(x: pt.x - r * 1.9, y: pt.y - r * 0.5, width: r * 3.8, height: r))
                context.stroke(ring, with: .color(tint.opacity(0.8)), lineWidth: 1)
            }
            if !vp.detailIsTelephoto {
                context.draw(Text(b.name).font(.system(size: 9, weight: .medium, design: .monospaced)).foregroundColor(tint.opacity(0.85)),
                             at: CGPoint(x: pt.x + r + 4, y: pt.y), anchor: .leading)
            }
        }
    }

    // MARK: Overlays

    private func reticle(size: CGSize) -> some View {
        let locked = model.lockedTarget != nil
        return ZStack {
            // Center crosshair
            Path { p in
                let c = CGPoint(x: size.width / 2, y: size.height / 2)
                p.move(to: CGPoint(x: c.x - 14, y: c.y)); p.addLine(to: CGPoint(x: c.x - 4, y: c.y))
                p.move(to: CGPoint(x: c.x + 4, y: c.y)); p.addLine(to: CGPoint(x: c.x + 14, y: c.y))
                p.move(to: CGPoint(x: c.x, y: c.y - 14)); p.addLine(to: CGPoint(x: c.x, y: c.y - 4))
                p.move(to: CGPoint(x: c.x, y: c.y + 4)); p.addLine(to: CGPoint(x: c.x, y: c.y + 14))
            }
            .stroke(neon.opacity(0.85), lineWidth: 1)

            // Snap-on targeting box
            RoundedRectangle(cornerRadius: 4)
                .stroke(neon, lineWidth: 1.2)
                .frame(width: 46, height: 46)
                .shadow(color: neon.opacity(0.7), radius: 6)
                .scaleEffect(locked ? 1 : 1.6)
                .opacity(locked ? 1 : 0)
                .animation(.spring(response: 0.25, dampingFraction: 0.6), value: locked)
                .position(x: size.width / 2, y: size.height / 2)
        }
    }

    private func hud(size: CGSize) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                glassPanel {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("DELPHI · SKY").font(.system(size: 10, weight: .semibold, design: .monospaced)).foregroundStyle(neon)
                        rowMono("HDG", String(format: "%05.1f°", model.headingDeg))
                        rowMono("ALT", String(format: "%+05.1f°", model.pitchDeg))
                        rowMono("ZOOM", SkyViewport.formatZoom(model.scale))
                        rowMono("FEED", model.isLive ? "LIVE" : "MOCK")
                    }
                }
                Spacer()
                glassPanel {
                    VStack(alignment: .trailing, spacing: 3) {
                        rowMono("SAT", "\(model.satellites.count)")
                        rowMono("ACFT", "\(model.aircraft.count)")
                    }
                }
            }
            Spacer()
            if let t = model.lockedTarget {
                glassPanel {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Circle().fill(neon).frame(width: 6, height: 6)
                            Text(t.label.uppercased()).font(.system(size: 12, weight: .semibold, design: .monospaced)).foregroundStyle(.white)
                            Text(t.kind.rawValue.uppercased()).font(.system(size: 8, weight: .medium, design: .monospaced)).foregroundStyle(neon.opacity(0.8))
                        }
                        ForEach(t.detail) { row in
                            HStack {
                                Text(row.key).font(.system(size: 10, design: .monospaced)).foregroundStyle(dim)
                                Spacer()
                                Text(row.value).font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.white)
                                    .monospacedDigit()
                            }
                        }
                    }
                    .frame(width: 180)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(16)
        .animation(.easeInOut(duration: 0.2), value: model.lockedTarget)
    }

    private func rowMono(_ key: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Text(key).font(.system(size: 10, design: .monospaced)).foregroundStyle(dim)
            Text(value).font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.white).monospacedDigit()
        }
    }

    private func glassPanel<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white.opacity(0.12), lineWidth: 0.6))
    }
}

// MARK: - Helpers

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255
        let g = Double((rgb >> 8) & 0xFF) / 255
        let b = Double(rgb & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

#if DEBUG
#Preview {
    CelestialSkyView()
}
#endif
