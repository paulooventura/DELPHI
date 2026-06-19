import SwiftUI
import CosmicClock

@main
struct CosmicClockApp: App {
    @StateObject private var model = CosmicClockViewModel()
    @StateObject private var launch = LaunchViewModel()
    @State private var showLaunch = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                CosmicClockView()
                    .environmentObject(model)
                if showLaunch {
                    LaunchScreenView(model: launch, now: .now)
                        .transition(.opacity)
                }
            }
            .onAppear {
                model.start()
                launch.start(now: .now, telemetryReady: { !model.layers.isEmpty }) {
                    withAnimation { showLaunch = false }
                }
            }
        }
    }
}

@MainActor
final class CosmicClockViewModel: ObservableObject {
    @Published var layers: [CycleLayer] = []
    private let engine = CosmicClockEngine(latitude: 36.1627, longitude: -86.7816)
    private var timer: Timer?

    func start() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
        refresh()
    }

    func refresh() {
        layers = engine.tick()
    }
}

struct CosmicClockView: View {
    @EnvironmentObject private var model: CosmicClockViewModel

    var body: some View {
        ZStack {
            Color(red: 0.04, green: 0.06, blue: 0.1).ignoresSafeArea()
            Canvas { context, size in
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                let base = min(size.width, size.height) * 0.38
                for (i, layer) in model.layers.enumerated() {
                    let r = base + CGFloat(i) * 18
                    var path = Path()
                    path.addEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
                    context.stroke(path, with: .color(.white.opacity(0.25)), lineWidth: 1.2)
                    let angle = Angle(degrees: layer.angleDeg - 90)
                    let tip = CGPoint(
                        x: center.x + r * cos(angle.radians),
                        y: center.y + r * sin(angle.radians)
                    )
                    var needle = Path()
                    needle.move(to: center)
                    needle.addLine(to: tip)
                    context.stroke(needle, with: .color(.yellow.opacity(0.85)), lineWidth: 1)
                }
            }
            VStack {
                Text("Cosmic Clock")
                    .font(.caption)
                    .foregroundStyle(.yellow)
                Spacer()
            }
            .padding()
        }
        .onAppear { model.start() }
    }
}

#if DEBUG
#Preview {
    CosmicClockView()
        .environmentObject(CosmicClockViewModel())
}
#endif
