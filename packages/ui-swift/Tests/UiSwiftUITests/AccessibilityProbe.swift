// TEMPORARY CI probe: which setup makes SwiftUI expose its accessibility tree
// in an XCTest process. Removed once the answer is known.

#if os(macOS)
import AppKit
import SwiftUI
import XCTest

@testable import UiSwiftCore
@testable import UiSwiftUI

@MainActor
final class AccessibilityProbe: XCTestCase {
    private func walk(_ root: Any) -> [String] {
        var out: [String] = []
        var queue: [(Any, Int)] = [(root, 0)]
        while !queue.isEmpty {
            let (next, depth) = queue.removeFirst()
            guard let e = next as? NSAccessibilityProtocol else {
                out.append("\(depth) non-AX \(type(of: next))")
                continue
            }
            let kids = e.accessibilityChildren() ?? []
            out.append(
                "\(depth) \(type(of: e)) role=\(e.accessibilityRole()?.rawValue ?? "-") id=\(e.accessibilityIdentifier() ?? "-") label=\(e.accessibilityLabel() ?? "-") kids=\(kids.count)"
            )
            queue += kids.map { ($0, depth + 1) }
        }
        return out
    }

    private func probe(_ step: String) {
        let hosting = NSHostingView(
            rootView: UiView(document: UiDocumentModel(lino: "(app: document (body: stack (greeting: text hi) (ok: button (label OK))))"))
                .frame(width: 300, height: 200))
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 200), styleMask: [.titled], backing: .buffered,
            defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = hosting
        window.orderFront(nil)
        hosting.layoutSubtreeIfNeeded()
        for tick in [0.0, 0.3, 1.0, 2.0] {
            RunLoop.main.run(until: Date().addingTimeInterval(tick))
            let lines = walk(hosting)
            print("PROBE \(step) t=\(tick) count=\(lines.count)")
            lines.prefix(30).forEach { print("PROBE   \($0)") }
            if lines.contains(where: { $0.contains("id=ok") }) { break }
        }
        let viaWindow = walk(window).filter { $0.contains("id=") && !$0.contains("id=-") }
        print("PROBE \(step) via window: \(viaWindow)")
        window.close()
    }

    func testProbe() {
        _ = NSApplication.shared
        probe("plain")
        NSApp.setActivationPolicy(.accessory)
        NSApp.finishLaunching()
        probe("finishLaunching")
        typealias SetEnabled = @convention(c) (Bool) -> Void
        if let lib = dlopen("/usr/lib/libAccessibility.dylib", RTLD_NOW) {
            for name in ["_AXSApplicationAccessibilitySetEnabled", "_AXSSetAutomationEnabled"] {
                if let sym = dlsym(lib, name) {
                    unsafeBitCast(sym, to: SetEnabled.self)(true)
                    print("PROBE called \(name)")
                } else {
                    print("PROBE missing \(name)")
                }
            }
        } else {
            print("PROBE no libAccessibility")
        }
        probe("axsEnabled")
        NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXEnhancedUserInterface"))
        NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXManualAccessibility"))
        probe("enhancedUI")
    }
}
#endif
