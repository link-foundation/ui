// swift-tools-version:5.9
// The Swift packages of link-foundation/ui, at the repository root so that
// consumers can add the repository URL to SwiftPM (issue #30):
//
// - `LinksNotation`: the vendored Links Notation parser
//   (native/swift/LinksNotation, issue #29; see docs/native-parsers.md);
// - `UiSwiftCore`: the element tree, the tree projection of docs/spec, design
//   tokens and the platform-neutral render tree (Foundation only, so it also
//   builds and tests on Linux);
// - `UiSwiftUI`: the SwiftUI renderer `UiView(document:)` (Apple platforms);
// - `UiDemo`: a macOS SwiftUI app that renders the issue-1 sample document.
//
// There are no package dependencies, so there is no Package.resolved.
import PackageDescription

var products: [Product] = [
    .library(name: "LinksNotation", targets: ["LinksNotation"]),
    .library(name: "UiSwiftCore", targets: ["UiSwiftCore"]),
]

var targets: [Target] = [
    .target(
        name: "LinksNotation",
        path: "native/swift/LinksNotation/Sources/LinksNotation"
    ),
    .target(
        name: "UiSwiftCore",
        dependencies: ["LinksNotation"],
        path: "packages/ui-swift/Sources/UiSwiftCore"
    ),
    .testTarget(
        name: "UiSwiftCoreTests",
        dependencies: ["UiSwiftCore", "LinksNotation"],
        path: "packages/ui-swift/Tests/UiSwiftCoreTests"
    ),
]

// SwiftUI exists only on Apple platforms; on Linux the package is the parser
// and the platform-neutral core.
#if os(macOS) || os(iOS) || os(tvOS) || os(watchOS) || os(visionOS)
products += [
    .library(name: "UiSwiftUI", targets: ["UiSwiftUI"]),
    .executable(name: "UiDemo", targets: ["UiDemo"]),
]
targets += [
    .target(
        name: "UiSwiftUI",
        dependencies: ["UiSwiftCore"],
        path: "packages/ui-swift/Sources/UiSwiftUI"
    ),
    .testTarget(
        name: "UiSwiftUITests",
        dependencies: ["UiSwiftUI", "UiSwiftCore"],
        path: "packages/ui-swift/Tests/UiSwiftUITests"
    ),
    .executableTarget(
        name: "UiDemo",
        dependencies: ["UiSwiftUI", "UiSwiftCore"],
        path: "examples/swift/UiDemo"
    ),
]
#endif

let package = Package(
    name: "LinkFoundationUI",
    // SwiftUI `@Observable` needs macOS 14 and iOS 17.
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: products,
    targets: targets
)
