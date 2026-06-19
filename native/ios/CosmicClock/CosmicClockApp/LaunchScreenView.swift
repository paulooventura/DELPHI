import SwiftUI
import CosmicClock

enum LaunchPhase: Equatable, Comparable {
    case void, awakening, ripple, calibration, transition, done

    private var order: Int {
        switch self {
        case .void: 0
        case .awakening: 1
        case .ripple: 2
        case .calibration: 3
        case .transition: 4
        case .done: 5
        }
    }

    static func < (lhs: LaunchPhase, rhs: LaunchPhase) -> Bool { lhs.order < rhs.order }
}

enum LogoStage: Int, Comparable {
    case void = 0, axis, eye, stars, moon, full

    static func < (lhs: LogoStage, rhs: LogoStage) -> Bool { lhs.rawValue < rhs.rawValue }
}

@MainActor
final class LaunchViewModel: ObservableObject {
    @Published var phase: LaunchPhase = .void
    @Published var logoStage: LogoStage = .void
    @Published var progress: Double = 0
    @Published var ringsExpanded = false
    @Published var placeLabel = "UNVEILING THE ORACLE"
    @Published var exiting = false

    private var engine = CosmicClockEngine(latitude: 36.1627, longitude: -86.7816)

    func start(now: Date, telemetryReady: @escaping () -> Bool, onComplete: @escaping () -> Void) {
        Task {
            try? await Task.sleep(for: .milliseconds(350))
            phase = .awakening
            logoStage = .axis
            try? await Task.sleep(for: .milliseconds(200))
            logoStage = .eye
            try? await Task.sleep(for: .milliseconds(200))
            logoStage = .stars
            try? await Task.sleep(for: .milliseconds(140))
            logoStage = .moon
            try? await Task.sleep(for: .milliseconds(100))
            logoStage = .full
            try? await Task.sleep(for: .milliseconds(130))
            phase = .ripple
            ringsExpanded = true
            try? await Task.sleep(for: .milliseconds(350))
            phase = .calibration
            while progress < 100 {
                try? await Task.sleep(for: .milliseconds(40))
                progress = min(100, progress + (telemetryReady() ? 4.5 : 2.2))
            }
            phase = .transition
            exiting = true
            try? await Task.sleep(for: .milliseconds(520))
            phase = .done
            onComplete()
        }
    }
}

struct LaunchScreenView: View {
    @ObservedObject var model: LaunchViewModel
    let now: Date

    var body: some View {
        ZStack {
            RadialGradient(
                colors: [Color(red: 0.05, green: 0.07, blue: 0.1), Color(red: 0.02, green: 0.03, blue: 0.04)],
                center: .center,
                startRadius: 20,
                endRadius: 420
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                ZStack {
                    if model.phase >= .ripple {
                        SplashRingsView(expanded: model.ringsExpanded)
                            .frame(width: 280, height: 280)
                            .scaleEffect(model.ringsExpanded ? 1 : 0.5)
                            .opacity(model.ringsExpanded ? 0.85 : 0)
                            .animation(.spring(response: 1.1, dampingFraction: 0.72), value: model.ringsExpanded)
                    }
                    OracleLogoView(stage: model.logoStage)
                        .frame(width: 100, height: 100)
                }
                .scaleEffect(model.exiting ? 1.35 : 1)
                .opacity(model.exiting ? 0 : 1)
                .animation(.easeInOut(duration: 0.52), value: model.exiting)

                Text("DELPHI")
                    .font(.system(size: 28, weight: .semibold, design: .default))
                    .kerning(10)
                    .foregroundStyle(Color(red: 0.91, green: 0.78, blue: 0.45))

                Text("COSMIC CLOCK | ASTRONOMICAL GUIDANCE")
                    .font(.system(size: 9, weight: .medium))
                    .kerning(2)
                    .foregroundStyle(.white.opacity(0.45))

                VStack(spacing: 6) {
                    Text(now.formatted(.dateTime.weekday(.wide).month(.wide).day().year()).uppercased())
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                    Text(now.formatted(date: .omitted, time: .standard).uppercased())
                        .font(.system(size: 26, weight: .medium, design: .monospaced))
                        .foregroundStyle(.white)
                    Text("\(model.placeLabel) | UNVEILING THE ORACLE")
                        .font(.system(size: 10, weight: .medium))
                        .kerning(1)
                        .foregroundStyle(Color(red: 0.79, green: 0.64, blue: 0.28))
                }
                .padding(.top, 8)

                HStack(spacing: 10) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.12))
                            Capsule()
                                .fill(LinearGradient(colors: [.yellow.opacity(0.5), .yellow], startPoint: .leading, endPoint: .trailing))
                                .frame(width: geo.size.width * model.progress / 100)
                            Circle()
                                .fill(.yellow)
                                .frame(width: 8, height: 8)
                                .shadow(color: .yellow.opacity(0.9), radius: 6)
                                .offset(x: max(0, geo.size.width * model.progress / 100 - 4))
                        }
                    }
                    .frame(height: 8)
                    Text("\(Int(model.progress))%")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.55))
                }
                .frame(maxWidth: 260)
            }
            .padding()
        }
    }
}

struct OracleLogoView: View {
    let stage: LogoStage

    var body: some View {
        Canvas { context, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let gold = GraphicsContext.Shading.color(Color(red: 0.91, green: 0.78, blue: 0.45))
            if stage >= .axis {
                var staff = Path()
                staff.move(to: CGPoint(x: c.x, y: c.y - 30))
                staff.addLine(to: CGPoint(x: c.x, y: c.y + 28))
                context.stroke(staff, with: gold, lineWidth: 1.4)
            }
            if stage >= .eye {
                var eye = Path()
                eye.addEllipse(in: CGRect(x: c.x - 18, y: c.y - 6, width: 36, height: 22))
                context.stroke(eye, with: gold, lineWidth: 1.2)
            }
        }
    }
}

struct SplashRingsView: View {
    let expanded: Bool

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            for i in 0..<5 {
                let r = 28 + CGFloat(i) * 22
                var ring = Path()
                ring.addEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
                context.stroke(ring, with: .color(.yellow.opacity(0.35 + Double(i) * 0.08)), lineWidth: 0.8)
            }
        }
    }
}
