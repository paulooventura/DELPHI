// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CosmicClock",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "CosmicClock", targets: ["CosmicClock"]),
    ],
    targets: [
        .target(name: "CosmicClock"),
        .testTarget(name: "CosmicClockTests", dependencies: ["CosmicClock"]),
    ]
)
