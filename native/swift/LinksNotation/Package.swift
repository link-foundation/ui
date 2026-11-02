// swift-tools-version:5.9
// The Swift port of Links Notation (LiNo). See docs/native-parsers.md at the
// repository root for why it lives here and how it is kept in step with the
// JavaScript reference implementation.
import PackageDescription

let package = Package(
    name: "LinksNotation",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "LinksNotation", targets: ["LinksNotation"])
    ],
    targets: [
        .target(name: "LinksNotation"),
        .testTarget(name: "LinksNotationTests", dependencies: ["LinksNotation"]),
    ]
)
