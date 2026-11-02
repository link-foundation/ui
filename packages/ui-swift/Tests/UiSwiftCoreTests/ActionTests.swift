// Behaviour: handlers are data handed to the host, never executed, and
// unsafe navigation targets are rejected (docs/spec/behaviour.md).

import XCTest

@testable import UiSwiftCore

final class ActionTests: XCTestCase {
    func testPressingOkSendsTheNavigateAction() throws {
        let text = try readText(repositoryRoot.appendingPathComponent("docs/case-studies/issue-1/samples/document.lino"))
        let ok = RenderTree(lino: text).node(id: "ok")!
        var received: [UiAction] = []
        ok.fire("press") { received.append($0) }
        XCTAssertEqual(received, [UiAction(source: "ok", event: "press", action: ["navigate", "home"])])
        XCTAssertEqual(ok.fire("hover"), [], "an event without a handler does nothing")
    }

    func testJavascriptTargetIsRejected() {
        for target in ["'javascript:alert(1)'", "'  JavaScript:alert(1)'", "'data:text/html,hi'", "'vbscript:x'"] {
            let tree = RenderTree(lino: "(evil: button Click (on press (navigate \(target))))")
            XCTAssertEqual(tree.node(id: "evil")!.fire("press"), [], target)
            XCTAssertTrue(
                tree.diagnostics.contains(
                    UiDiagnostic(code: "unsafe-url", severity: .error, at: ["element": "evil", "property": "on"])),
                target)
        }
        XCTAssertTrue(isUnsafeNavigationTarget(" javascript:void(0)"))
        XCTAssertFalse(isUnsafeNavigationTarget("https://example.com/javascript:"))
    }

    func testStringsAreNeverExecuted() {
        let tree = RenderTree(lino: "(bad: button Bad (on press 'alert(1)'))\n(run: button Run (on press (eval 'alert(1)')))")
        XCTAssertEqual(tree.node(id: "bad")!.handlers, [])
        XCTAssertEqual(tree.node(id: "run")!.handlers, [])
        XCTAssertEqual(Set(tree.diagnostics.map(\.code)), ["invalid-handler", "unknown-action"])
    }

    func testSeveralActionsRunInOrder() throws {
        let fixture = fixturesDirectory.appendingPathComponent("behaviour/several-actions.lino")
        let save = RenderTree(lino: try readText(fixture)).node(id: "save")!
        XCTAssertEqual(save.fire("press").map(\.action), [
            ["set", "status", "value", "Saving"], ["emit", "save"], ["toggle", "menu", "open"], ["focus", "status"],
        ])
    }

    func testSafeNavigationIsKept() throws {
        let fixture = fixturesDirectory.appendingPathComponent("behaviour/navigate.lino")
        let docs = RenderTree(lino: try readText(fixture)).node(id: "docs-link")!
        XCTAssertEqual(docs.fire("press"), [
            UiAction(source: "docs-link", event: "press", action: ["navigate", "https://example.com/docs"])
        ])
    }
}
