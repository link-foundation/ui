// The element tree of a ui-dialect/0 document (docs/spec/elements.md), with
// the field names of the tree JSON (`docs/spec/element-tree.schema.json`):
// `id`, `kind`, `positional`, `properties`, `children` and `unknown`.

/// The version of the UI dialect this package reads.
public let uiSpecVersion = "ui-dialect/0"

/// A value as the parser gives it (docs/spec/values.md, "JSON form"):
/// a reference atom, a nested link without an id (a list of its values), or a
/// nested link with an id.
public indirect enum UiValue: Equatable, Hashable, Sendable {
    /// A reference atom such as `OK`, `16px` or `#6750A4`.
    case atom(String)
    /// A nested link without an id: `(navigate home)` is `["navigate", "home"]`.
    case list([UiValue])
    /// A nested link with an id: `{ "id": ..., "values": [...] }`.
    case link(id: String, values: [UiValue])

    /// The text of an atom, `nil` for a link.
    public var atom: String? {
        if case .atom(let text) = self { return text }
        return nil
    }

    /// The values of a nested link, `nil` for an atom.
    public var values: [UiValue]? {
        switch self {
        case .atom: return nil
        case .list(let values): return values
        case .link(_, let values): return values
        }
    }
}

/// A property of an element: `(gap 16px)` is `UiProp(name: "gap", values: [.atom("16px")])`.
public struct UiProp: Equatable, Hashable, Sendable {
    public var name: String
    public var values: [UiValue]

    public init(name: String, values: [UiValue]) {
        self.name = name
        self.values = values
    }
}

/// An element: a link whose id is the element id and whose first value is
/// its kind (docs/spec/elements.md).
public struct UiNode: Equatable, Hashable, Sendable {
    /// The element id, `nil` for an anonymous element.
    public let id: String?
    /// The kind, `nil` when the element has none (`missing-kind`).
    public let kind: String?
    /// The positional values (atoms after the kind), in source order.
    public var positional: [String]
    /// The properties, in source order.
    public var properties: [UiProp]
    /// The child elements, in source order.
    public var children: [UiNode]
    /// The sublinks that are neither properties nor children, kept for round trips.
    public var unknown: [UiValue]

    public init(
        id: String?, kind: String?, positional: [String] = [], properties: [UiProp] = [],
        children: [UiNode] = [], unknown: [UiValue] = []
    ) {
        self.id = id
        self.kind = kind
        self.positional = positional
        self.properties = properties
        self.children = children
        self.unknown = unknown
    }

    /// The values of the last property with this name (single-valued
    /// properties are "last wins"), or `nil`.
    public func property(_ name: String) -> [UiValue]? {
        properties.last(where: { $0.name == name })?.values
    }

    /// Every property with this name, in source order (multi-valued properties such as `on`).
    public func properties(named name: String) -> [UiProp] {
        properties.filter { $0.name == name }
    }
}

/// How serious a diagnostic is (docs/spec/limits.md).
public enum UiSeverity: String, Equatable, Hashable, Sendable {
    case error
    case warning
    case info
}

/// A diagnostic `{ code, severity, at }` (docs/spec/limits.md). `at` holds
/// the keys that apply (`element`, `property`, `head`, `kind`, `token`,
/// `line`, `column`); a `nil` value is a JSON `null`.
public struct UiDiagnostic: Equatable, Hashable, Sendable, CustomStringConvertible {
    public let code: String
    public let severity: UiSeverity
    public let at: [String: UiDiagnosticValue]

    public init(code: String, severity: UiSeverity, at: [String: UiDiagnosticValue] = [:]) {
        self.code = code
        self.severity = severity
        self.at = at
    }

    public var description: String {
        let place = at.keys.sorted().map { "\($0)=\(at[$0]!)" }.joined(separator: " ")
        return place.isEmpty ? "\(severity.rawValue) \(code)" : "\(severity.rawValue) \(code) (\(place))"
    }
}

/// A value of a diagnostic's `at` object.
public enum UiDiagnosticValue: Equatable, Hashable, Sendable, CustomStringConvertible,
    ExpressibleByStringLiteral, ExpressibleByIntegerLiteral
{
    case string(String)
    case number(Int)
    case null

    public init(_ text: String?) {
        self = text.map(UiDiagnosticValue.string) ?? .null
    }

    public init(stringLiteral value: String) { self = .string(value) }
    public init(integerLiteral value: Int) { self = .number(value) }

    public var description: String {
        switch self {
        case .string(let text): return text
        case .number(let number): return String(number)
        case .null: return "null"
        }
    }
}

/// A projected document: `{ "spec", "elements", "unknown"?, "diagnostics" }`.
public struct UiDocument: Equatable, Sendable {
    /// The top-level elements, in source order.
    public var elements: [UiNode]
    /// Top-level links that are not elements.
    public var unknown: [UiValue]
    /// What the projection reported; a parser error is the only diagnostic
    /// of an empty tree.
    public var diagnostics: [UiDiagnostic]

    public init(elements: [UiNode] = [], unknown: [UiValue] = [], diagnostics: [UiDiagnostic] = []) {
        self.elements = elements
        self.unknown = unknown
        self.diagnostics = diagnostics
    }

    /// The element with this id, searched depth first.
    public func element(id: String) -> UiNode? {
        func find(_ nodes: [UiNode]) -> UiNode? {
            for node in nodes {
                if node.id == id { return node }
                if let found = find(node.children) { return found }
            }
            return nil
        }
        return find(elements)
    }
}

/// The action a pressed control asks the host to run, as data: `(on press
/// (navigate home))` on `ok` is `UiAction(source: "ok", event: "press",
/// action: ["navigate", "home"])`.
public struct UiAction: Equatable, Hashable, Sendable {
    /// The id of the element the handler belongs to (`""` for an anonymous element).
    public let source: String
    /// The event name, such as `press`.
    public let event: String
    /// The action head and its arguments, such as `["navigate", "home"]`.
    public let action: [String]

    public init(source: String, event: String, action: [String]) {
        self.source = source
        self.event = event
        self.action = action
    }
}
