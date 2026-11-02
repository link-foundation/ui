// Render-tree snapshots of the spec fixtures. Every fixture of
// docs/spec/fixtures (except errors/) whose elements all have a rendered kind
// has `Tests/Snapshots/<area>/<name>.render.lino`; a new fixture without one,
// or a snapshot without its fixture, fails. Run with UPDATE_SNAPSHOTS=1 to
// write the snapshots.

import Foundation
import LinksNotation
import XCTest

@testable import UiSwiftCore

final class FixtureTests: XCTestCase {
    private var updating: Bool { ProcessInfo.processInfo.environment["UPDATE_SNAPSHOTS"] == "1" }

    /// The fixtures whose every element has a kind the renderer draws.
    private func renderableFixtures() throws -> [(Fixture, UiDocument)] {
        try allFixtures().filter { $0.area != "errors" }.compactMap { fixture in
            let document = project(try readText(fixture.url))
            func supported(_ node: UiNode) -> Bool {
                node.kind.map(uiRenderedKinds.contains) == true && node.children.allSatisfy(supported)
            }
            guard !document.elements.isEmpty, document.elements.allSatisfy(supported) else { return nil }
            return (fixture, document)
        }
    }

    func testEveryRenderableFixtureHasItsSnapshot() throws {
        let fixtures = try renderableFixtures()
        XCTAssertGreaterThan(fixtures.count, 20, "too few fixtures use only rendered kinds")
        for (fixture, document) in fixtures {
            let dump = RenderTree(document: document).dumpLino()
            if updating {
                try FileManager.default.createDirectory(
                    at: fixture.snapshotURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try dump.write(to: fixture.snapshotURL, atomically: true, encoding: .utf8)
                continue
            }
            guard let snapshot = try? readText(fixture.snapshotURL) else {
                XCTFail("\(fixture.label) has no snapshot; run UPDATE_SNAPSHOTS=1 swift test")
                continue
            }
            XCTAssertEqual(dump, snapshot, fixture.label)
        }
    }

    func testNoSnapshotWithoutItsFixture() throws {
        let expected = Set(try renderableFixtures().map { $0.0.snapshotURL.standardizedFileURL.path })
        let manager = FileManager.default
        guard let walker = manager.enumerator(at: snapshotsDirectory, includingPropertiesForKeys: nil) else {
            return XCTFail("no Tests/Snapshots directory")
        }
        for case let url as URL in walker where url.pathExtension == "lino" {
            XCTAssertTrue(expected.contains(url.standardizedFileURL.path), "stale snapshot \(url.path)")
        }
    }

    /// The render tree keeps the element ids and the parent/child pairs of the fixture's tree JSON.
    func testRenderTreeKeepsTheIdsAndPairsOfTheTreeJSON() throws {
        for (fixture, document) in try renderableFixtures() {
            let tree = try JSON(file: fixture.expectedURL)
            var expected: [String] = []
            func visit(_ element: JSON, parent: String) {
                let id = element["id"]?.string ?? "-"
                expected.append("\(parent) > \(id)")
                element["children"]?.array?.forEach { visit($0, parent: id) }
            }
            tree["elements"]?.array?.forEach { visit($0, parent: "-") }
            var actual: [String] = []
            func walk(_ node: RenderNode, parent: String) {
                let id = node.accessibilityIdentifier ?? "-"
                actual.append("\(parent) > \(id)")
                node.children.forEach { walk($0, parent: id) }
            }
            RenderTree(document: document).roots.forEach { walk($0, parent: "-") }
            XCTAssertEqual(actual, expected, fixture.label)
        }
    }

    /// Every snapshot is Links Notation the parser reads back.
    func testSnapshotsParse() throws {
        for (fixture, _) in try renderableFixtures() {
            guard let text = try? readText(fixture.snapshotURL) else { continue }
            XCTAssertNoThrow(try Parser().parse(text), fixture.label)
            XCTAssertEqual(project(text).diagnostics.filter { $0.severity == .error && $0.code.hasPrefix("syntax") }, [])
        }
    }
}
