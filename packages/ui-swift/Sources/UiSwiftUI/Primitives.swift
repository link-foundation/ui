// The SwiftUI view of each render-tree primitive (see RenderTree.swift for the
// kind-to-primitive table). Every view carries `.accessibilityIdentifier(id)`
// with the element's link id, and the native label of its kind: the text of
// a `Text`, the label of a `Button`, `alt` of an image and `title` of a document.

import SwiftUI
import UiSwiftCore
import os

struct UiPrimitiveView<Children: View>: View {
    let node: RenderNode
    let theme: UiTheme
    let onAction: (UiAction) -> Void
    @ViewBuilder let children: () -> Children

    var body: some View {
        switch node.primitive {
        case .scrollView:
            ScrollView {
                VStack(alignment: .leading, spacing: 0) { children() }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .identified(node, container: true)
        case .vStack:
            VStack(alignment: horizontalAlignment, spacing: points("spacing")) { children() }
                .padding(points("padding") ?? 0)
                .identified(node, container: true)
        case .hStack:
            HStack(alignment: verticalAlignment, spacing: points("spacing")) { children() }
                .padding(points("padding") ?? 0)
                .identified(node, container: true)
        case .text:
            Text(verbatim: node.text ?? "")
                .identified(node)
        case .button:
            Button {
                node.fire("press", onAction: onAction)
            } label: {
                Text(verbatim: node.prop("label")?.text ?? "")
            }
            .buttonStyle(.borderedProminent)
            .disabled(node.prop("disabled")?.text == "true")
            .identified(node)
        case .asyncImage:
            AsyncImage(url: node.prop("url")?.text.flatMap(URL.init(string:))) { image in
                image.resizable().scaledToFit()
            } placeholder: {
                Color.secondary.opacity(0.2)
            }
            .frame(width: points("width"), height: points("height"))
            .accessibilityElement(children: .ignore)
            .accessibilityAddTraits(.isImage)
            .identified(node)
        case .emptyView:
            // An unsupported kind: nothing is drawn; `UiDiagnosticLog` has logged `unsupported-kind`.
            EmptyView()
                .identified(node)
        }
    }

    private func points(_ name: String) -> CGFloat? {
        node.prop(name)?.number.map { CGFloat($0) }
    }

    private var horizontalAlignment: HorizontalAlignment {
        switch node.prop("alignment")?.text {
        case "leading": return .leading
        case "trailing": return .trailing
        default: return .center
        }
    }

    private var verticalAlignment: VerticalAlignment {
        switch node.prop("alignment")?.text {
        case "top": return .top
        case "bottom": return .bottom
        default: return .center
        }
    }
}

extension View {
    /// The element's link id as the accessibility identifier, and its native label.
    /// A container keeps its children as separate accessibility elements.
    @ViewBuilder
    func identified(_ node: RenderNode, container: Bool = false) -> some View {
        let labelled = self.modifier(UiAccessibilityLabel(label: node.accessibilityLabel))
        if container {
            labelled
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier(node.accessibilityIdentifier ?? "")
        } else {
            labelled.accessibilityIdentifier(node.accessibilityIdentifier ?? "")
        }
    }
}

private struct UiAccessibilityLabel: ViewModifier {
    let label: String?

    func body(content: Content) -> some View {
        if let label {
            content.accessibilityLabel(Text(verbatim: label))
        } else {
            content
        }
    }
}

/// Writes the renderer's diagnostics to the unified log (subsystem
/// `link-foundation.ui`, category `render`), each one once, and keeps them for
/// hosts and tests.
public final class UiDiagnosticLog: @unchecked Sendable {
    public static let shared = UiDiagnosticLog()

    private let logger = Logger(subsystem: "link-foundation.ui", category: "render")
    private let lock = NSLock()
    private var seen = Set<String>()
    private var all: [UiDiagnostic] = []

    /// Every diagnostic reported so far, in order, without repeats.
    public var diagnostics: [UiDiagnostic] {
        lock.lock()
        defer { lock.unlock() }
        return all
    }

    func report(_ diagnostics: [UiDiagnostic]) {
        for diagnostic in diagnostics {
            lock.lock()
            let isNew = seen.insert(diagnostic.description).inserted
            if isNew { all.append(diagnostic) }
            lock.unlock()
            guard isNew else { continue }
            switch diagnostic.severity {
            case .error: logger.error("\(diagnostic.description, privacy: .public)")
            default: logger.warning("\(diagnostic.description, privacy: .public)")
            }
        }
    }
}
