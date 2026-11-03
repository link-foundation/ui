// Every row of the render mapping (README.md, "Mapping") and the
// unsupported-kind diagnostic.

import XCTest

@testable import UiSwiftCore

final class RenderTreeTests: XCTestCase {
    private func render(_ text: String, theme: UiTheme = .default) -> RenderTree {
        RenderTree(lino: text, theme: theme)
    }

    func testSampleDocumentDumpsAsTheIssueShows() throws {
        let text = try readText(repositoryRoot.appendingPathComponent("docs/case-studies/issue-1/samples/document.lino"))
        let tree = render(text)
        XCTAssertEqual(
            tree.dumpLino(),
            """
            app: ScrollView
              body: VStack (spacing 16)
                greeting: Text 'Hello, links'
                ok: Button (label OK)

            """)
        XCTAssertEqual(tree.diagnostics, [])
    }

    func testDocumentIsAScrollViewLabelledByItsTitle() {
        let node = render("(app: document (title 'My app'))").roots[0]
        XCTAssertEqual(node.primitive, .scrollView)
        XCTAssertEqual(node.accessibilityLabel, "My app")
    }

    func testStackDirectionChoosesVStackOrHStack() {
        let tree = render(
            "(v: stack (gap 8px) (padding 1rem) (align start))\n(h: stack (direction horizontal) (gap 4px) (align end))")
        let vertical = tree.node(id: "v")!
        XCTAssertEqual(vertical.primitive, .vStack)
        XCTAssertEqual(vertical.props, [
            RenderProp("spacing", .atom("8")), RenderProp("padding", .atom("16")), RenderProp("alignment", .atom("leading")),
        ])
        let horizontal = tree.node(id: "h")!
        XCTAssertEqual(horizontal.primitive, .hStack)
        XCTAssertEqual(horizontal.props, [RenderProp("spacing", .atom("4")), RenderProp("alignment", .atom("bottom"))])
        XCTAssertEqual(render("(s: stack)").roots[0].primitive, .vStack, "vertical is the default")
    }

    func testTextShowsItsValue() {
        let tree = render("(a: text 'Hello, links')\n(b: text (value Bye))")
        XCTAssertEqual(tree.node(id: "a")!.primitive, .text)
        XCTAssertEqual(tree.node(id: "a")!.text, "Hello, links")
        XCTAssertEqual(tree.node(id: "a")!.accessibilityLabel, "Hello, links")
        XCTAssertEqual(tree.node(id: "b")!.text, "Bye")
    }

    func testButtonHasItsLabel() {
        let tree = render("(a: button (label 'OK'))\n(b: button Save (disabled true))")
        XCTAssertEqual(tree.node(id: "a")!.primitive, .button)
        XCTAssertEqual(tree.node(id: "a")!.props, [RenderProp("label", .atom("OK"))])
        XCTAssertEqual(tree.node(id: "a")!.accessibilityLabel, "OK")
        XCTAssertEqual(tree.node(id: "b")!.props, [RenderProp("label", .atom("Save")), RenderProp("disabled", .atom("true"))])
    }

    func testImageIsAnAsyncImageLabelledByAlt() {
        let tree = render("(logo: image 'https://example.com/logo.png' (alt 'Company logo') (width 64px) (height 2rem))")
        let image = tree.node(id: "logo")!
        XCTAssertEqual(image.primitive, .asyncImage)
        XCTAssertEqual(image.accessibilityLabel, "Company logo")
        XCTAssertEqual(image.prop("url")?.text, "https://example.com/logo.png")
        XCTAssertEqual(image.prop("width")?.number, 64)
        XCTAssertEqual(image.prop("height")?.number, 32)
        XCTAssertEqual(
            image.dumpLino(), "logo: AsyncImage (url 'https://example.com/logo.png') (width 64) (height 32) (alt 'Company logo')")
    }

    func testImageWithAnUnsafeSourceHasNoURL() {
        let tree = render("(x: image (source 'javascript:alert(1)'))")
        XCTAssertNil(tree.node(id: "x")!.prop("url"))
        XCTAssertTrue(tree.diagnostics.contains { $0.code == "unsafe-url" && $0.at["element"] == "x" })
    }

    func testUnknownKindIsAnEmptyViewWithADiagnostic() {
        let tree = render("(page: document (chart-1: chart (series 1 2 3) (inner: text Hidden)) (after: text Shown))")
        let chart = tree.node(id: "chart-1")!
        XCTAssertEqual(chart.primitive, .emptyView)
        XCTAssertEqual(chart.children, [], "the children of an unsupported kind are not rendered")
        XCTAssertNil(tree.node(id: "inner"))
        XCTAssertEqual(tree.node(id: "after")?.primitive, .text)
        XCTAssertTrue(tree.diagnostics.contains(
            UiDiagnostic(code: "unsupported-kind", severity: .warning, at: ["element": "chart-1", "kind": "chart"])))
        XCTAssertEqual(chart.dumpLino(), "chart-1: EmptyView")
    }

    func testKnownButUnrenderedKindIsAnEmptyView() {
        let tree = render("(t: theme (token a 1px))")
        XCTAssertEqual(tree.roots[0].primitive, .emptyView)
        XCTAssertEqual(tree.diagnostics.map(\.code), ["unsupported-kind"])
    }

    func testEveryNodeIsIdentifiedByItsLinkId() throws {
        let text = try readText(repositoryRoot.appendingPathComponent("docs/case-studies/issue-1/samples/document.lino"))
        let tree = render(text)
        XCTAssertEqual(tree.allNodes.map(\.accessibilityIdentifier), ["app", "body", "greeting", "ok"])
        for node in tree.allNodes {
            XCTAssertEqual(node.accessibilityIdentifier, node.id)
        }
    }

    func testAnonymousElementsAreRendered() {
        let tree = render("(form: stack (text Name) (button Save))")
        XCTAssertEqual(tree.dumpLino(), "form: VStack\n  Text Name\n  Button (label Save)\n")
    }
}
