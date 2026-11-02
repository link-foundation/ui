// The Swift projection gives, for every fixture of docs/spec/fixtures, the
// tree (or, under errors/, the diagnostics) the fixture's JSON expects, as
// scripts/check-spec-fixtures.mjs checks for the reference projection.

import XCTest

@testable import UiSwiftCore

final class ProjectionTests: XCTestCase {
    func testEveryFixtureProjectsToItsExpectedJSON() throws {
        let fixtures = try allFixtures()
        XCTAssertGreaterThan(fixtures.count, 50, "the spec fixtures were not found")
        for fixture in fixtures {
            let document = project(try readText(fixture.url))
            let expected = try JSON(file: fixture.expectedURL).normalized
            let actual: JSON
            if fixture.area == "errors" {
                actual = .object([
                    "spec": .string(uiSpecVersion),
                    "diagnostics": JSON.sortedDiagnostics(document.diagnostics.map(JSON.init)),
                ])
            } else {
                actual = JSON(tree: document)
            }
            XCTAssertEqual(actual, expected, fixture.label)
        }
    }

    func testVocabularyTextIsTheSpecVocabulary() throws {
        let spec = try readText(repositoryRoot.appendingPathComponent("docs/spec/vocabulary.lino"))
        XCTAssertEqual(uiVocabularyText, spec, "regenerate VocabularyText.swift from docs/spec/vocabulary.lino")
    }

    func testStandardVocabularyHasTheRenderedKindsAndActions() {
        let vocabulary = UiVocabulary.standard
        for kind in ["document", "stack", "text", "button", "image"] {
            XCTAssertNotNil(vocabulary.kinds[kind], kind)
        }
        XCTAssertEqual(Set(vocabulary.actions.keys), ["navigate", "emit", "set", "toggle", "focus"])
        XCTAssertEqual(vocabulary.kinds["stack"]?.properties["gap"]?.type, .atom("dimension"))
    }

    func testInputLimits() {
        let tooLarge = String(repeating: "a ", count: uiMaxInputSize / 2 + 1)
        XCTAssertEqual(project(tooLarge).diagnostics.map(\.code), ["input-too-large"])
        let deep = String(repeating: "(", count: uiMaxDepth + 2) + "a" + String(repeating: ")", count: uiMaxDepth + 2)
        XCTAssertEqual(project(deep).diagnostics.map(\.code), ["depth-exceeded"])
    }
}
