// The platform-neutral render tree: what UiSwiftUI draws, as data, so that it
// can be tested on any platform and compared with the other ports (#32).
//
// | kind       | primitive              | from                                   |
// | ---------- | ---------------------- | -------------------------------------- |
// | `document` | `ScrollView`           | `title` is the accessibility label     |
// | `stack`    | `VStack` / `HStack`    | `direction`; `gap` -> `spacing`, `padding`, `align` -> `alignment` |
// | `text`     | `Text`                 | `value`, or the positional values      |
// | `button`   | `Button`               | `label` (or positional); `on` handlers |
// | `image`    | `AsyncImage`           | `source` -> `url`, `alt` -> label, `width`, `height` |
// | any other  | `EmptyView`            | an `unsupported-kind` diagnostic; children are not rendered |

/// The SwiftUI primitive a node is drawn with.
public enum RenderPrimitive: String, CaseIterable, Sendable {
    case scrollView = "ScrollView"
    case vStack = "VStack"
    case hStack = "HStack"
    case text = "Text"
    case button = "Button"
    case asyncImage = "AsyncImage"
    case emptyView = "EmptyView"
}

/// One property of a render node: `(spacing 16)`.
public struct RenderProp: Equatable, Sendable {
    public let name: String
    public let values: [UiValue]

    public init(_ name: String, _ values: UiValue...) {
        self.name = name
        self.values = values
    }

    /// The first value as text.
    public var text: String? { values.first?.atom }
    /// The first value as a number.
    public var number: Double? { text.flatMap(Double.init) }
}

/// One drawn view.
public struct RenderNode: Equatable, Sendable {
    /// The element id (`nil` for an anonymous element). It is the view's
    /// `accessibilityIdentifier`.
    public let id: String?
    public let kind: String?
    public let primitive: RenderPrimitive
    /// The text a `Text` shows.
    public let text: String?
    /// The resolved properties, in a fixed order per primitive.
    public let props: [RenderProp]
    /// What assistive technologies read (`nil` to keep the platform's default).
    public let accessibilityLabel: String?
    /// The checked `(on ...)` handlers.
    public let handlers: [UiHandler]
    public var children: [RenderNode]

    public init(
        id: String?, kind: String?, primitive: RenderPrimitive, text: String? = nil, props: [RenderProp] = [],
        accessibilityLabel: String? = nil, handlers: [UiHandler] = [], children: [RenderNode] = []
    ) {
        self.id = id
        self.kind = kind
        self.primitive = primitive
        self.text = text
        self.props = props
        self.accessibilityLabel = accessibilityLabel
        self.handlers = handlers
        self.children = children
    }

    /// The `accessibilityIdentifier` of the view: the link id.
    public var accessibilityIdentifier: String? { id }

    public func prop(_ name: String) -> RenderProp? {
        props.first { $0.name == name }
    }

    /// The actions an event runs, sent to `onAction` in order and returned.
    @discardableResult
    public func fire(_ event: String, onAction: (UiAction) -> Void = { _ in }) -> [UiAction] {
        let actions = handlers.actions(for: event, source: id)
        actions.forEach(onAction)
        return actions
    }

    /// The node and its descendants, depth first.
    public var allNodes: [RenderNode] {
        [self] + children.flatMap(\.allNodes)
    }
}

/// A rendered document: its roots and what the renderer reported.
public struct RenderTree: Equatable, Sendable {
    public var roots: [RenderNode]
    /// The renderer's diagnostics (`unsupported-kind`, `unresolved-token`,
    /// dropped handlers, values it cannot draw), after the projection's.
    public var diagnostics: [UiDiagnostic]

    /// Render a projected document.
    public init(document: UiDocument, theme: UiTheme = .default, vocabulary: UiVocabulary = .standard) {
        var diagnostics = document.diagnostics
        func build(_ node: UiNode) -> RenderNode {
            let head = renderHead(node, theme: theme, vocabulary: vocabulary)
            diagnostics += head.diagnostics
            var rendered = head.node
            if rendered.primitive != .emptyView {
                rendered.children = node.children.map(build)
            }
            return rendered
        }
        roots = document.elements.map(build)
        self.diagnostics = diagnostics
    }

    /// Project and render LiNo text.
    public init(lino text: String, theme: UiTheme = .default) {
        self.init(document: project(text), theme: theme)
    }

    /// Every node, depth first.
    public var allNodes: [RenderNode] { roots.flatMap(\.allNodes) }

    public func node(id: String) -> RenderNode? { allNodes.first { $0.id == id } }
}

/// Render one element without its children (UiSwiftUI renders each element
/// from its own observable model).
public func renderHead(
    _ node: UiNode, theme: UiTheme = .default, vocabulary: UiVocabulary = .standard
) -> (node: RenderNode, diagnostics: [UiDiagnostic]) {
    var diagnostics: [UiDiagnostic] = []
    let element = UiDiagnosticValue(node.id)

    /// The resolved atom of the last `name` property, or `nil`.
    func resolved(_ name: String) -> String? {
        guard let value = node.property(name)?.first else { return nil }
        let resolution = theme.resolve(value, element: node.id, property: name)
        diagnostics += resolution.diagnostics
        return resolution.value?.atom
    }
    func cannotDraw(_ name: String) {
        diagnostics.append(UiDiagnostic(
            code: "unsupported-value", severity: .warning, at: ["element": element, "property": .string(name)]))
    }
    func points(_ name: String, as renamed: String? = nil) -> RenderProp? {
        guard let text = resolved(name) else { return nil }
        guard let value = uiPoints(text) else {
            cannotDraw(name)
            return nil
        }
        return RenderProp(renamed ?? name, .atom(uiNumberText(value)))
    }
    func text(_ name: String) -> String? {
        resolved(name) ?? (node.positional.isEmpty ? nil : node.positional.joined(separator: " "))
    }

    let head: RenderNode
    switch node.kind {
    case "document":
        head = RenderNode(
            id: node.id, kind: node.kind, primitive: .scrollView, accessibilityLabel: resolved("title"))
    case "stack":
        let horizontal = resolved("direction") == "horizontal"
        var props = [points("gap", as: "spacing"), points("padding")].compactMap { $0 }
        if let align = resolved("align") {
            let alignment: String
            switch (align, horizontal) {
            case ("start", false): alignment = "leading"
            case ("end", false): alignment = "trailing"
            case ("start", true): alignment = "top"
            case ("end", true): alignment = "bottom"
            default: alignment = "center"
            }
            props.append(RenderProp("alignment", .atom(alignment)))
        }
        head = RenderNode(id: node.id, kind: node.kind, primitive: horizontal ? .hStack : .vStack, props: props)
    case "text":
        let content = text("value") ?? ""
        head = RenderNode(id: node.id, kind: node.kind, primitive: .text, text: content, accessibilityLabel: content)
    case "button":
        let label = text("label") ?? ""
        let (handlers, problems) = uiHandlers(of: node, vocabulary: vocabulary)
        diagnostics += problems
        var props = [RenderProp("label", .atom(label))]
        if resolved("disabled") == "true" { props.append(RenderProp("disabled", .atom("true"))) }
        head = RenderNode(
            id: node.id, kind: node.kind, primitive: .button, props: props, accessibilityLabel: label,
            handlers: handlers)
    case "image":
        var props: [RenderProp] = []
        if let source = text("source") {
            if valueMatches(.atom("url"), .atom(source)) && !isUnsafeNavigationTarget(source) {
                props.append(RenderProp("url", .atom(source)))
            } else {
                diagnostics.append(UiDiagnostic(
                    code: "unsafe-url", severity: .error, at: ["element": element, "property": "source"]))
            }
        }
        props += [points("width"), points("height")].compactMap { $0 }
        let alt = resolved("alt")
        if let alt { props.append(RenderProp("alt", .atom(alt))) }
        head = RenderNode(id: node.id, kind: node.kind, primitive: .asyncImage, props: props, accessibilityLabel: alt)
    default:
        diagnostics.append(UiDiagnostic(
            code: "unsupported-kind", severity: .warning,
            at: ["element": element, "kind": UiDiagnosticValue(node.kind)]))
        head = RenderNode(id: node.id, kind: node.kind, primitive: .emptyView)
    }
    return (head, diagnostics)
}

/// The kinds the renderer draws (every other kind is an `EmptyView`).
public let uiRenderedKinds: Set<String> = ["document", "stack", "text", "button", "image"]
