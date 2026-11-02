// The SwiftUI renderer on macOS: the vendored F11 tokens equal the default
// theme, `setProp` invalidates only its element, and the views SwiftUI builds
// carry the link ids as accessibility identifiers and send `UiAction`s.

#if os(macOS)
import AppKit
import Observation
import SwiftUI
import XCTest

@testable import UiSwiftCore
@testable import UiSwiftUI

private let sample = """
    (app: document
      (title 'Links UI demo')
      (body: stack
        (direction vertical)
        (gap (token space.medium))
        (greeting: text 'Hello, links')
        (ok: button
          (label 'OK')
          (variant filled)
          (on press (navigate home)))))
    """

final class TokensTests: XCTestCase {
    private func points(_ name: String) -> CGFloat? {
        UiTheme.default.lookup(name)?.atom.flatMap(uiPoints).map { CGFloat($0) }
    }

    /// Tokens.swift is the ui-tokens F11 output; UiTheme.default must say the same.
    func testDefaultThemeMatchesTokens() throws {
        XCTAssertEqual(points("space.medium"), Tokens.spaceMedium)
        XCTAssertEqual(points("shape.corner.medium"), Tokens.shapeCornerMedium)
        let seconds = try XCTUnwrap(UiTheme.default.lookup("motion.duration.short")?.atom.flatMap(uiSeconds))
        XCTAssertEqual(seconds, Tokens.motionDurationShort, accuracy: 1e-9)
        for (name, color) in [("color.primary", Tokens.colorPrimary), ("color.on-primary", Tokens.colorOnPrimary)] {
            let expected = try XCTUnwrap(NSColor(color).usingColorSpace(.sRGB), name)
            let actual = try XCTUnwrap(UiTheme.default.color(name).flatMap { NSColor($0).usingColorSpace(.sRGB) }, name)
            // Tokens.swift rounds the channels to three decimals.
            XCTAssertEqual(actual.redComponent, expected.redComponent, accuracy: 0.002, name)
            XCTAssertEqual(actual.greenComponent, expected.greenComponent, accuracy: 0.002, name)
            XCTAssertEqual(actual.blueComponent, expected.blueComponent, accuracy: 0.002, name)
            XCTAssertEqual(actual.alphaComponent, expected.alphaComponent, accuracy: 0.002, name)
        }
    }
}

final class UiDocumentModelTests: XCTestCase {
    private final class Flag: @unchecked Sendable { var changed = false }

    private func watch(_ read: @escaping () -> Void) -> Flag {
        let flag = Flag()
        withObservationTracking(read) { flag.changed = true }
        return flag
    }

    func testSetPropInvalidatesOnlyThatElement() throws {
        let model = UiDocumentModel(lino: sample)
        let body = try XCTUnwrap(model.element(id: "body"))
        let greeting = try XCTUnwrap(model.element(id: "greeting"))
        let ok = try XCTUnwrap(model.element(id: "ok"))
        let bodyChanged = watch { _ = body.node; _ = body.children }
        let okChanged = watch { _ = ok.node }
        let greetingChanged = watch { _ = greeting.node }
        let rootsChanged = watch { _ = model.roots }

        XCTAssertTrue(model.setProp(id: "greeting", name: "value", values: [.atom("Bye")]))

        XCTAssertTrue(greetingChanged.changed)
        XCTAssertFalse(bodyChanged.changed)
        XCTAssertFalse(okChanged.changed)
        XCTAssertFalse(rootsChanged.changed)
        XCTAssertEqual(RenderTree(document: model.document).node(id: "greeting")?.text, "Bye")
        XCTAssertFalse(model.setProp(id: "missing", name: "value", values: [.atom("x")]))
    }

    func testDocumentRoundTrips() {
        let document = project(sample)
        XCTAssertEqual(UiDocumentModel(document: document).document, document)
    }
}

/// The accessibility tree SwiftUI builds for a hosted `UiView`.
@MainActor
final class UiViewAccessibilityTests: XCTestCase {
    private var window: NSWindow?

    override func tearDown() async throws {
        await MainActor.run {
            window?.close()
            window = nil
        }
    }

    private func host(_ view: some View) -> NSView {
        let hosting = NSHostingView(rootView: view.frame(width: 400, height: 300))
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 300), styleMask: [.titled], backing: .buffered,
            defer: false)
        window.contentView = hosting
        window.orderFront(nil)
        hosting.layoutSubtreeIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))
        self.window = window
        return hosting
    }

    /// Every accessibility element below `root`, depth first.
    private func elements(_ root: Any) -> [NSAccessibilityProtocol] {
        var found: [NSAccessibilityProtocol] = []
        var queue: [Any] = [root]
        while !queue.isEmpty {
            let next = queue.removeFirst()
            guard let element = next as? NSAccessibilityProtocol else { continue }
            found.append(element)
            queue += element.accessibilityChildren() ?? []
        }
        return found
    }

    func testEveryViewIsIdentifiedByItsLinkId() {
        let model = UiDocumentModel(lino: sample)
        let hosting = host(UiView(document: model))
        let identifiers = Set(elements(hosting).compactMap { $0.accessibilityIdentifier() }.filter { !$0.isEmpty })
        let expected = Set(RenderTree(document: model.document).allNodes.compactMap(\.accessibilityIdentifier))
        XCTAssertEqual(expected, ["app", "body", "greeting", "ok"])
        XCTAssertTrue(expected.isSubset(of: identifiers), "accessibility identifiers: \(identifiers.sorted())")
    }

    func testNativeLabelsAndPress() throws {
        var actions: [UiAction] = []
        let hosting = host(UiView(document: UiDocumentModel(lino: sample)) { actions.append($0) })
        let all = elements(hosting)
        let ok = try XCTUnwrap(all.first { $0.accessibilityIdentifier() == "ok" })
        XCTAssertEqual(ok.accessibilityLabel(), "OK")
        XCTAssertEqual(all.first { $0.accessibilityIdentifier() == "greeting" }?.accessibilityLabel(), "Hello, links")
        XCTAssertTrue(ok.accessibilityPerformPress())
        RunLoop.main.run(until: Date().addingTimeInterval(0.2))
        XCTAssertEqual(actions, [UiAction(source: "ok", event: "press", action: ["navigate", "home"])])
    }

    func testUnknownKindDrawsNothingAndLogs() {
        let model = UiDocumentModel(lino: "(app: document\n  (strange: marquee (child: text hidden)))")
        _ = host(UiView(document: model))
        XCTAssertTrue(
            UiDiagnosticLog.shared.diagnostics.contains {
                $0.code == "unsupported-kind" && $0.at["element"] == "strange" && $0.at["kind"] == "marquee"
            }, "\(UiDiagnosticLog.shared.diagnostics)")
    }
}
#endif
