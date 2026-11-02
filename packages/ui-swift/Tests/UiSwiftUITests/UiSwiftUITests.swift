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
        withObservationTracking(read, onChange: { flag.changed = true })
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
    /// Show `view` in a window until the test ends.
    private func host(_ view: some View) -> NSView {
        _ = NSApplication.shared
        enableAccessibility()
        let hosting = NSHostingView(rootView: view.frame(width: 400, height: 300))
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 300), styleMask: [.titled], backing: .buffered,
            defer: false)
        // Owned by ARC here; the default (true) frees it a second time on close.
        window.isReleasedWhenClosed = false
        window.contentView = hosting
        window.orderFront(nil)
        hosting.layoutSubtreeIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))
        addTeardownBlock { @MainActor in window.close() }
        return hosting
    }

    /// SwiftUI builds its accessibility tree only once an assistive client
    /// asks for it; these are the attributes such a client (VoiceOver,
    /// Accessibility Inspector) sets on the app. Without them the hosting view
    /// has no children at all.
    private func enableAccessibility() {
        for attribute in ["AXEnhancedUserInterface", "AXManualAccessibility"] {
            NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: attribute))
        }
    }

    /// Every accessibility element below `root`, breadth first. SwiftUI's
    /// elements (`AccessibilityNode`) answer the NSAccessibility selectors
    /// without conforming to `NSAccessibilityProtocol` in Swift, so they are
    /// asked by selector.
    private func elements(_ root: NSObject) -> [AXElement] {
        var found: [AXElement] = []
        var queue = [root]
        while !queue.isEmpty {
            let element = AXElement(object: queue.removeFirst())
            found.append(element)
            queue += element.children
        }
        return found
    }

    func testEveryViewIsIdentifiedByItsLinkId() {
        let model = UiDocumentModel(lino: sample)
        let hosting = host(UiView(document: model))
        let identifiers = Set(elements(hosting).compactMap(\.identifier).filter { !$0.isEmpty })
        let expected = Set(RenderTree(document: model.document).allNodes.compactMap(\.accessibilityIdentifier))
        XCTAssertEqual(expected, ["app", "body", "greeting", "ok"])
        XCTAssertTrue(expected.isSubset(of: identifiers), "accessibility identifiers: \(identifiers.sorted())")
    }

    func testNativeLabelsAndPress() throws {
        var actions: [UiAction] = []
        let hosting = host(UiView(document: UiDocumentModel(lino: sample)) { actions.append($0) })
        let all = elements(hosting)
        let ok = try XCTUnwrap(all.first { $0.identifier == "ok" }, "\(all.map(\.description))")
        XCTAssertEqual(ok.label, "OK")
        let greeting = try XCTUnwrap(all.first { $0.identifier == "greeting" })
        XCTAssertEqual(greeting.spoken, "Hello, links", greeting.description)
        ok.press()
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

/// One accessibility element, read through the NSAccessibility selectors.
@MainActor
private struct AXElement {
    let object: NSObject

    private func string(_ selector: String) -> String? {
        let name = NSSelectorFromString(selector)
        guard object.responds(to: name) else { return nil }
        switch object.perform(name)?.takeUnretainedValue() {
        case let text as String: return text
        case let text as NSAttributedString: return text.string
        default: return nil
        }
    }

    var identifier: String? { string("accessibilityIdentifier") }
    var label: String? { string("accessibilityLabel") }
    var value: String? { string("accessibilityValue") }
    var role: String? { string("accessibilityRole") }
    /// What VoiceOver reads: the label, or for a static text (whose text
    /// AppKit exposes as its AXValue) the value.
    var spoken: String? { label.flatMap { $0.isEmpty ? nil : $0 } ?? value }

    var children: [NSObject] {
        let name = NSSelectorFromString("accessibilityChildren")
        guard object.responds(to: name) else { return [] }
        return object.perform(name)?.takeUnretainedValue() as? [NSObject] ?? []
    }

    /// `accessibilityPerformPress`, as VoiceOver's "press" does. Its BOOL
    /// result is not read (`perform` returns objects); the test checks the
    /// `UiAction` it sends instead.
    func press() {
        let name = NSSelectorFromString("accessibilityPerformPress")
        if object.responds(to: name) { _ = object.perform(name) }
    }

    var description: String {
        "\(type(of: object)) role=\(role ?? "-") id=\(identifier ?? "-") label=\(label ?? "-") value=\(value ?? "-")"
    }
}
#endif
