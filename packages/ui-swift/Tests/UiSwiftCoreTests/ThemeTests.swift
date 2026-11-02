// Token resolution: the F11 default theme, a theme read at runtime with the
// parser, fallbacks, and missing or cyclic tokens as diagnostics.

import XCTest

@testable import UiSwiftCore

final class ThemeTests: XCTestCase {
    func testSpaceMediumResolvesThroughTheDefaultTheme() {
        let resolution = UiTheme.default.resolve(
            .list([.atom("token"), .atom("space.medium")]), element: "body", property: "gap")
        XCTAssertEqual(resolution.value, .atom("16px"))
        XCTAssertEqual(resolution.diagnostics, [])
        let tree = RenderTree(lino: "(body: stack (gap (token space.medium)))")
        XCTAssertEqual(tree.roots[0].prop("spacing")?.number, 16)
    }

    func testDefaultThemeIsTheF11Tokens() {
        // The values of packages/ui-tokens/tests/golden/Tokens.swift.
        let theme = UiTheme.default
        let primary = UiColor(hex: theme.lookup("color.primary")!.atom!)!
        XCTAssertEqual(primary.red, 0.404, accuracy: 0.0005)
        XCTAssertEqual(primary.green, 0.314, accuracy: 0.0005)
        XCTAssertEqual(primary.blue, 0.643, accuracy: 0.0005)
        XCTAssertEqual(primary.opacity, 1)
        XCTAssertEqual(UiColor(hex: theme.lookup("color.on-primary")!.atom!), UiColor(red: 1, green: 1, blue: 1))
        XCTAssertEqual(uiPoints(theme.lookup("space.medium")!.atom!), 16)
        XCTAssertEqual(uiPoints(theme.lookup("shape.corner.medium")!.atom!), 12)
        XCTAssertEqual(uiSeconds(theme.lookup("motion.duration.short")!.atom!), 0.15)
    }

    func testTokensLinoLoadedAtRuntimeEqualsTheDefault() throws {
        let text = try readText(repositoryRoot.appendingPathComponent("docs/case-studies/issue-1/samples/tokens.lino"))
        let theme = try UiTheme(lino: text, base: nil)
        XCTAssertEqual(theme.active, "material3")
        XCTAssertEqual(theme.sets, UiTheme.default.sets)
    }

    func testMissingTokenIsADiagnosticNotACrash() {
        let tree = RenderTree(lino: "(body: stack (gap (token space.huge)))")
        XCTAssertNil(tree.roots[0].prop("spacing"))
        XCTAssertEqual(tree.diagnostics, [
            UiDiagnostic(
                code: "unresolved-token", severity: .warning,
                at: ["element": "body", "property": "gap", "token": "space.huge"])
        ])
    }

    func testFallbackTakesTheFirstThatResolves() {
        let tree = RenderTree(lino: "(s: stack (gap (or (token space.large) (token space.medium) 8px)))")
        XCTAssertEqual(tree.roots[0].prop("spacing")?.number, 16)
        XCTAssertEqual(tree.diagnostics, [])
        let literal = RenderTree(lino: "(s: stack (gap (or (token space.large) 8px)))")
        XCTAssertEqual(literal.roots[0].prop("spacing")?.number, 8)
    }

    func testRuntimeThemeOverridesAndExtends() throws {
        let theme = try UiTheme(lino: """
            (compact: theme (extends material3) (token space.medium 8px) (token space.small (token space.medium)))
            (material3: theme (token color.primary '#000000'))
            """)
        XCTAssertEqual(theme.active, "compact")
        XCTAssertEqual(theme.lookup("space.medium"), .atom("8px"))
        XCTAssertEqual(theme.lookup("color.primary"), .atom("#000000"), "the extended set comes before the base")
        XCTAssertEqual(theme.lookup("shape.corner.medium"), .atom("12px"), "the default theme is the base")
        let resolved = theme.resolve(.list([.atom("token"), .atom("space.small")]), element: nil, property: "gap")
        XCTAssertEqual(resolved.value, .atom("8px"))
    }

    func testCycleIsADiagnosticNotACrash() throws {
        let theme = try UiTheme(document: UiDocument(elements: [
            UiNode(id: "loop", kind: "theme", properties: [
                UiProp(name: "token", values: [.atom("a"), .list([.atom("token"), .atom("b")])]),
                UiProp(name: "token", values: [.atom("b"), .list([.atom("token"), .atom("a")])]),
            ])
        ]))
        let resolution = theme.resolve(.list([.atom("token"), .atom("a")]), element: "x", property: "gap")
        XCTAssertNil(resolution.value)
        XCTAssertEqual(resolution.diagnostics.map(\.code), ["reference-cycle"])
    }

    func testThemeErrors() {
        XCTAssertThrowsError(try UiTheme(lino: "(a: text Hi)")) { XCTAssertEqual($0 as? UiThemeError, .noTheme) }
        XCTAssertThrowsError(try UiTheme(lino: "(a: theme)", active: "b")) {
            XCTAssertEqual($0 as? UiThemeError, .unknownTheme("b"))
        }
        XCTAssertThrowsError(try UiTheme(lino: "(a: theme")) {
            guard case .diagnostic(let diagnostic)? = $0 as? UiThemeError else { return XCTFail("\($0)") }
            XCTAssertEqual(diagnostic.code, "syntax-error")
        }
    }

    func testTypedValues() {
        XCTAssertEqual(uiPoints("0"), 0)
        XCTAssertEqual(uiPoints("1.5rem"), 24)
        XCTAssertNil(uiPoints("50%"))
        XCTAssertNil(uiPoints("16"))
        XCTAssertEqual(uiSeconds("0.2s"), 0.2)
        XCTAssertEqual(UiColor(hex: "#f00"), UiColor(red: 1, green: 0, blue: 0))
        XCTAssertNil(UiColor(hex: "#12345"))
        XCTAssertEqual(uiNumberText(16), "16")
        XCTAssertEqual(uiNumberText(1.5), "1.5")
    }
}
