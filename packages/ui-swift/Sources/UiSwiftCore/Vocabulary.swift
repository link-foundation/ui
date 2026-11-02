// The kinds, properties and actions of docs/spec/vocabulary.lino, read the
// way scripts/spec-reference-projection.mjs reads them: the vocabulary is
// itself a ui-dialect/0 document, projected with a bootstrap vocabulary.

/// A property a kind declares: `(property gap dimension)`.
public struct UiPropertySpec: Equatable, Sendable {
    /// The declared type: an atom (`dimension`) or a list (`(enum vertical
    /// horizontal)`); `nil` when the declaration has none.
    public let type: UiValue?
    /// Whether the property may occur several times (`multi`).
    public let multi: Bool

    public init(type: UiValue?, multi: Bool = false) {
        self.type = type
        self.multi = multi
    }
}

/// A kind of the vocabulary: `(button: kind ...)`.
public struct UiKindSpec: Equatable, Sendable {
    public let positional: [UiValue]
    public let properties: [String: UiPropertySpec]
    /// `any` or `none`.
    public let children: UiValue

    public init(positional: [UiValue] = [], properties: [String: UiPropertySpec], children: UiValue = .atom("any")) {
        self.positional = positional
        self.properties = properties
        self.children = children
    }
}

/// The kinds and actions a document is read with.
public struct UiVocabulary: Equatable, Sendable {
    public let kinds: [String: UiKindSpec]
    /// Action name to its `(argument ...)` declarations.
    public let actions: [String: [[UiValue]]]

    public init(kinds: [String: UiKindSpec], actions: [String: [[UiValue]]]) {
        self.kinds = kinds
        self.actions = actions
    }

    /// The v0 vocabulary of `docs/spec/vocabulary.lino`.
    public static let standard: UiVocabulary = {
        do {
            return try UiVocabulary(lino: uiVocabularyText)
        } catch {
            fatalError("docs/spec/vocabulary.lino does not project: \(error)")
        }
    }()

    /// What the vocabulary itself is read with.
    static let bootstrap: UiVocabulary = {
        let any = UiPropertySpec(type: .atom("any"))
        let anyMulti = UiPropertySpec(type: .atom("any"), multi: true)
        let string = UiPropertySpec(type: .atom("string"))
        return UiVocabulary(
            kinds: [
                "kind": UiKindSpec(properties: [
                    "description": string, "positional": any, "property": anyMulti, "children": any,
                ]),
                "action": UiKindSpec(properties: ["description": string, "argument": anyMulti]),
                "dialect": UiKindSpec(properties: [
                    "version": string, "multi-valued": any, "reserved-sigil": any,
                    "reserved-property": anyMulti, "common-property": anyMulti,
                ]),
            ],
            actions: [:]
        )
    }()

    /// Read a vocabulary document.
    /// - Throws: `UiVocabularyError` when the document gives any diagnostic.
    public init(lino text: String) throws {
        let document = project(text, vocabulary: .bootstrap)
        guard document.diagnostics.isEmpty else {
            throw UiVocabularyError(diagnostics: document.diagnostics)
        }
        func entries(_ element: UiNode, _ name: String) -> [(String, UiPropertySpec)] {
            element.properties(named: name).compactMap { property in
                guard let first = property.values.first?.atom else { return nil }
                let type = property.values.count > 1 ? property.values[1] : nil
                let multi = property.values.dropFirst(2).contains(.atom("multi"))
                return (first, UiPropertySpec(type: type, multi: multi))
            }
        }
        let common = document.elements.filter { $0.kind == "dialect" }
            .flatMap { entries($0, "common-property") }
        var kinds: [String: UiKindSpec] = [:]
        var actions: [String: [[UiValue]]] = [:]
        for element in document.elements {
            guard let id = element.id else { continue }
            if element.kind == "kind" {
                var properties: [String: UiPropertySpec] = [:]
                for (name, spec) in common + entries(element, "property") {
                    properties[name] = spec
                }
                kinds[id] = UiKindSpec(
                    positional: element.properties(named: "positional").flatMap(\.values),
                    properties: properties,
                    children: element.properties(named: "children").first?.values.first ?? .atom("any")
                )
            } else if element.kind == "action" {
                actions[id] = element.properties(named: "argument").map(\.values)
            }
        }
        self.init(kinds: kinds, actions: actions)
    }
}

/// A vocabulary document that does not project cleanly.
public struct UiVocabularyError: Error, Equatable {
    public let diagnostics: [UiDiagnostic]
}
