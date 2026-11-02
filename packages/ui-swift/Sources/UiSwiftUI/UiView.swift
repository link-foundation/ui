// `UiView(document:)`: the SwiftUI renderer of a link-foundation/ui document.
//
//     let document = UiDocumentModel(lino: try String(contentsOf: url, encoding: .utf8))
//     UiView(document: document) { action in
//         // UiAction(source: "ok", event: "press", action: ["navigate", "home"])
//     }
//
// Every element is drawn by its own `UiElementView`, which reads only its own
// `UiElementModel`, so `document.setProp(id:name:values:)` draws that element
// again and nothing else. What each kind becomes is decided by `renderHead`
// in UiSwiftCore (the render tree the snapshot tests check), so the views and
// the snapshots cannot disagree.

import SwiftUI
import UiSwiftCore

public struct UiView: View {
    let document: UiDocumentModel
    let theme: UiTheme
    let onAction: (UiAction) -> Void

    /// - Parameters:
    ///   - document: the elements to draw.
    ///   - theme: where `(token ...)` values are looked up; by default the F11 tokens.
    ///   - onAction: called with each action of a handler, in order (`(on press (navigate home))`
    ///     on `ok` gives `UiAction(source: "ok", event: "press", action: ["navigate", "home"])`).
    ///     The renderer never runs anything itself.
    public init(document: UiDocumentModel, theme: UiTheme = .default, onAction: @escaping (UiAction) -> Void = { _ in }) {
        self.document = document
        self.theme = theme
        self.onAction = onAction
        UiDiagnosticLog.shared.report(document.diagnostics)
    }

    public var body: some View {
        Group {
            ForEach(document.roots) { root in
                UiElementView(model: root, theme: theme, onAction: onAction)
            }
        }
        .tint(theme.color("color.primary"))
    }
}

/// One element and, below it, the views of its children.
struct UiElementView: View {
    let model: UiElementModel
    let theme: UiTheme
    let onAction: (UiAction) -> Void

    var body: some View {
        let rendered = renderHead(model.node, theme: theme)
        UiDiagnosticLog.shared.report(rendered.diagnostics)
        return UiPrimitiveView(node: rendered.node, theme: theme, onAction: onAction) {
            ForEach(model.children) { child in
                UiElementView(model: child, theme: theme, onAction: onAction)
            }
        }
    }
}

extension UiTheme {
    /// A colour token as a SwiftUI colour, or `nil` when it is missing or not a hex colour.
    public func color(_ name: String) -> Color? {
        guard let text = resolve(.list([.atom("token"), .atom(name)]), element: nil, property: name).value?.atom,
            let color = UiColor(hex: text)
        else { return nil }
        return Color(.sRGB, red: color.red, green: color.green, blue: color.blue, opacity: color.opacity)
    }
}
