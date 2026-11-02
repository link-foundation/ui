// UiDemo: a macOS app that renders docs/case-studies/issue-1/samples/document.lino
// with UiView and shows the last UiAction the host received.
//
//     swift run UiDemo                                  # open the window
//     swift run UiDemo --document path/to/doc.lino      # another document
//     swift run UiDemo --theme path/to/theme.lino       # a theme read at runtime
//     swift run UiDemo --appearance dark                # light (default) or dark
//     swift run UiDemo --dump                           # print the render tree and exit
//     swift run UiDemo --screenshot out.png             # save the window as PNG and exit

import AppKit
import SwiftUI
import UiSwiftCore
import UiSwiftUI

let arguments = CommandLine.arguments

func option(_ name: String) -> String? {
    guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else { return nil }
    return arguments[index + 1]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

/// The repository root, found from this file (examples/swift/UiDemo/main.swift).
let repositoryRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent()
    .deletingLastPathComponent().deletingLastPathComponent()
let documentURL = option("--document").map(URL.init(fileURLWithPath:))
    ?? repositoryRoot.appendingPathComponent("docs/case-studies/issue-1/samples/document.lino")

let model: UiDocumentModel
let theme: UiTheme
do {
    model = UiDocumentModel(lino: try String(contentsOf: documentURL, encoding: .utf8))
    theme = try option("--theme").map { try UiTheme(lino: String(contentsOfFile: $0, encoding: .utf8)) } ?? .default
} catch {
    fail("UiDemo: \(error)")
}

if arguments.contains("--dump") {
    let tree = RenderTree(document: model.document, theme: theme)
    print(tree.dumpLino(), terminator: "")
    tree.diagnostics.forEach { print("diagnostic:", $0) }
    exit(0)
}

struct DemoView: View {
    let model: UiDocumentModel
    let theme: UiTheme
    @State private var lastAction = "none"

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            UiView(document: model, theme: theme) { action in
                lastAction = "\(action.source) \(action.event) → \(action.action.joined(separator: " "))"
            }
            Divider()
            Text("Last action: \(lastAction)")
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("demo.last-action")
        }
        .padding(20)
        .frame(width: 420, height: 240, alignment: .topLeading)
    }
}

let appearance = option("--appearance") ?? "light"
guard ["light", "dark"].contains(appearance) else { fail("UiDemo: --appearance is light or dark") }

let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.appearance = NSAppearance(named: appearance == "dark" ? .darkAqua : .aqua)

let window = NSWindow(
    contentRect: NSRect(x: 0, y: 0, width: 420, height: 240), styleMask: [.titled, .closable, .miniaturizable],
    backing: .buffered, defer: false)
window.title = "UiDemo — \(documentURL.lastPathComponent)"
window.appearance = app.appearance
window.contentView = NSHostingView(rootView: DemoView(model: model, theme: theme))
window.isReleasedWhenClosed = false
window.center()
window.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
let delegate = AppDelegate()
app.delegate = delegate

if let path = option("--screenshot") {
    // Give SwiftUI time to lay out and draw, then capture just this window.
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
        let capture = Process()
        capture.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        capture.arguments = ["-x", "-o", "-l", String(window.windowNumber), path]
        do {
            try capture.run()
            capture.waitUntilExit()
        } catch {
            fail("UiDemo: screencapture: \(error)")
        }
        guard capture.terminationStatus == 0, FileManager.default.fileExists(atPath: path) else {
            fail("UiDemo: screencapture failed (\(capture.terminationStatus))")
        }
        print("UiDemo: saved \(path)")
        exit(0)
    }
}

app.run()
