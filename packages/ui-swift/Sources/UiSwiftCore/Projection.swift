// The tree projection of docs/spec/projection.md: Links Notation text, read
// with the LinksNotation port (#29), becomes the element tree of
// docs/spec/elements.md with the diagnostics of docs/spec/limits.md.
//
// It follows scripts/spec-reference-projection.mjs step by step, so that
// the three parse shapes of one document (one line, several lines inside
// parentheses, indented) give one tree. The nodes are reference types while
// the tree is built, because path folding appends to nodes created earlier;
// the result is converted to the value types of Model.swift at the end.

import LinksNotation

/// The deepest nesting a document may have (docs/spec/limits.md).
public let uiMaxDepth = 64
/// The longest document, in UTF-16 code units (docs/spec/limits.md).
public let uiMaxInputSize = 1024 * 1024

/// Project LiNo text into a `UiDocument` with the given vocabulary.
public func project(_ text: String, vocabulary: UiVocabulary = .standard) -> UiDocument {
    if text.utf16.count > uiMaxInputSize {
        return UiDocument(diagnostics: [UiDiagnostic(code: "input-too-large", severity: .error)])
    }
    let links: [Link]
    do {
        links = try Parser(options: ParserOptions(maxDepth: uiMaxDepth, maxInputSize: uiMaxInputSize))
            .parseLocated(text)
    } catch let located as LocatedParseError {
        var at: [String: UiDiagnosticValue] = [:]
        if let line = located.line, let column = located.column {
            at = ["line": .number(line), "column": .number(column)]
        }
        let code: String
        switch located.error {
        case .depthExceeded: code = "depth-exceeded"
        case .inputTooLarge: code = "input-too-large"
        case .syntax: code = "syntax-error"
        }
        return UiDocument(diagnostics: [UiDiagnostic(code: code, severity: .error, at: at)])
    } catch {
        return UiDocument(diagnostics: [UiDiagnostic(code: "syntax-error", severity: .error)])
    }
    let projector = Projector(vocabulary)
    for link in links {
        projector.top(link)
    }
    var document = UiDocument(
        elements: projector.root.children.map(\.node),
        unknown: projector.root.unknown.map(\.value),
        diagnostics: projector.diagnostics
    )
    if !vocabulary.actions.isEmpty {
        document.diagnostics += checkValues(document, vocabulary)
        document.diagnostics += checkTokenCycles(document)
    }
    return document
}

// MARK: - Mutable nodes

/// A value while the tree is built: an atom, or a list or link whose values
/// later path links may still extend.
final class ValueBox {
    let atom: String?
    let id: String?
    var items: [ValueBox]

    init(atom: String) {
        self.atom = atom
        id = nil
        items = []
    }

    init(id: String?, items: [ValueBox]) {
        atom = nil
        self.id = id
        self.items = items
    }

    /// The JSON form of a link (values.md): atom to string, anonymous link to list.
    convenience init(_ link: Link) {
        if link.values.isEmpty {
            self.init(atom: link.id ?? "")
        } else {
            self.init(id: link.id, items: link.values.map(ValueBox.init))
        }
    }

    var value: UiValue {
        if let atom { return .atom(atom) }
        let values = items.map(\.value)
        if let id { return .link(id: id, values: values) }
        return .list(values)
    }
}

final class PropBox {
    let name: String
    var values: [ValueBox] = []

    init(name: String) { self.name = name }
}

final class ElementBox {
    let id: String?
    let kind: String?
    var positional: [String] = []
    var properties: [PropBox] = []
    var children: [ElementBox] = []
    var unknown: [ValueBox] = []

    init(id: String?, kind: String?) {
        self.id = id
        self.kind = kind
    }

    var node: UiNode {
        UiNode(
            id: id, kind: kind, positional: positional,
            properties: properties.map { UiProp(name: $0.name, values: $0.values.map(\.value)) },
            children: children.map(\.node), unknown: unknown.map(\.value)
        )
    }
}

/// A node path links can name: an element (or the root), or a value node
/// (a property, an unknown sublink, or a link nested in one of them).
final class Node {
    enum Store {
        case element(ElementBox)
        case property(PropBox)
        case value(ValueBox)
    }

    let store: Store
    /// The element a value node belongs to.
    let owner: ElementBox?
    /// The property name of a value node (`nil` for an unknown sublink).
    let name: String?
    let unknown: Bool
    /// The heads and paths known inside this node.
    var local: [String: Node] = [:]

    init(_ store: Store, owner: ElementBox? = nil, name: String? = nil, unknown: Bool = false) {
        self.store = store
        self.owner = owner
        self.name = name
        self.unknown = unknown
    }

    var element: ElementBox? {
        if case .element(let element) = store { return element }
        return nil
    }

    func appendValue(_ value: ValueBox) {
        switch store {
        case .element: break
        case .property(let property): property.values.append(value)
        case .value(let box): box.items.append(value)
        }
    }
}

private func isAtom(_ link: Link) -> Bool { link.values.isEmpty }

/// A path link: no id, and its first value is a link (projection.md).
private func isPath(_ link: Link) -> Bool {
    !isAtom(link) && link.id == nil && !isAtom(link.values[0])
}

/// The anonymous wrapper of a multi-line group, `(H (H a) (H b) ...)`.
private func isGroupWrapper(_ link: Link) -> Bool {
    guard isPath(link), link.values.count >= 2 else { return false }
    let key = link.values[0].format()
    return link.values.dropFirst().allSatisfy { isPath($0) && $0.values[0].format() == key }
}

// MARK: - Projector

final class Projector {
    let vocabulary: UiVocabulary
    var diagnostics: [UiDiagnostic] = []
    var ids = Set<String>()
    var global: [String: Node] = [:]
    let root = ElementBox(id: nil, kind: nil)
    let rootNode: Node

    init(_ vocabulary: UiVocabulary) {
        self.vocabulary = vocabulary
        rootNode = Node(.element(root))
    }

    func warn(_ code: String, _ at: [String: UiDiagnosticValue]) {
        diagnostics.append(UiDiagnostic(code: code, severity: .warning, at: at))
    }

    func error(_ code: String, _ at: [String: UiDiagnosticValue]) {
        diagnostics.append(UiDiagnostic(code: code, severity: .error, at: at))
    }

    /// The root accepts only elements: an atom there is an unknown sublink.
    func top(_ link: Link) {
        if isAtom(link) {
            warn("unknown-sublink", ["element": .null, "head": UiDiagnosticValue(link.id)])
            root.unknown.append(ValueBox(atom: link.id ?? ""))
            return
        }
        _ = append(rootNode, link)
    }

    /// Create an element node from a link with an id (or an anonymous kind).
    func makeElement(_ link: Link, id: String?) -> Node {
        let kindLink = link.values.first
        let kind = kindLink.flatMap { isAtom($0) ? $0.id : nil }
        let box = ElementBox(id: id, kind: kind)
        let element = Node(.element(box))
        if let id {
            if ids.contains(id) {
                error("duplicate-id", ["element": .string(id)])
            }
            ids.insert(id)
        }
        if let kind {
            if vocabulary.kinds[kind] == nil {
                warn("unknown-kind", ["element": UiDiagnosticValue(id), "kind": .string(kind)])
            }
        } else {
            error("missing-kind", ["element": UiDiagnosticValue(id)])
        }
        if id != nil {
            let head = Link(id: id, values: link.values.filter(isAtom))
            global[head.format()] = element
        }
        // The head names the element inside itself too, so the path links of
        // a multi-line group, ((text A) (style x)), fold into it.
        element.local[link.format()] = element
        for value in link.values.dropFirst() {
            _ = append(element, value)
        }
        return element
    }

    /// Append one value of the source to an element or value node.
    func append(_ node: Node, _ value: Link) -> Node? {
        guard let element = node.element else {
            return appendToProperty(node, value)
        }
        if isPath(value) {
            return fold(node, value)
        }
        if isAtom(value) {
            let text = value.id ?? ""
            checkSigil(text, element: element.id, property: nil)
            element.positional.append(text)
            return nil
        }
        if let id = value.id {
            let child = makeElement(value, id: id)
            element.children.append(child.element!)
            node.local[value.format()] = child
            return child
        }
        let head = value.values[0].id ?? ""
        let spec = element.kind.flatMap { vocabulary.kinds[$0] }
        if let property = spec?.properties[head] {
            return addProperty(node, value, name: head, spec: property)
        }
        if vocabulary.kinds[head] != nil {
            let child = makeElement(value, id: nil)
            element.children.append(child.element!)
            node.local[value.format()] = child
            return child
        }
        return keepUnknown(node, value, head: head)
    }

    /// Keep an unknown sublink as one value of `unknown`; its indented lines
    /// fold into it (projection.md).
    func keepUnknown(_ node: Node, _ link: Link, head: String) -> Node {
        let element = node.element!
        warn("unknown-sublink", ["element": UiDiagnosticValue(element.id), "head": .string(head)])
        let box = ValueBox(link)
        element.unknown.append(box)
        let unknown = Node(.value(box), owner: element, unknown: true)
        unknown.local[link.format()] = unknown
        node.local[link.format()] = unknown
        return unknown
    }

    func addProperty(_ node: Node, _ link: Link, name: String, spec: UiPropertySpec) -> Node {
        let element = node.element!
        let box = PropBox(name: name)
        let property = Node(.property(box), owner: element, name: name)
        // A multi-line property value folds back onto the property head.
        property.local[link.format()] = property
        if !spec.multi, let index = element.properties.firstIndex(where: { $0.name == name }) {
            warn("duplicate-property", ["element": UiDiagnosticValue(element.id), "property": .string(name)])
            element.properties.remove(at: index)
        }
        element.properties.append(box)
        node.local[link.format()] = property
        for value in link.values.dropFirst() {
            _ = appendToProperty(property, value)
        }
        return property
    }

    /// Append one value to a value node. Returns the value node of a nested
    /// link, so that the lines indented under it fold into it, or `nil`.
    func appendToProperty(_ property: Node, _ value: Link) -> Node? {
        if isPath(value) {
            // A path inside a multi-line value, e.g. ((track a) (key 0 1)).
            let first = value.values[0]
            let wrapper = isGroupWrapper(value)
            let target = wrapper ? appendToProperty(property, first) : property.local[first.format()]
            if let target {
                for item in value.values.dropFirst() {
                    if let created = appendToProperty(target, item) {
                        property.local[Link(values: [first, item]).format()] = created
                    }
                }
                return target
            }
        }
        let box = ValueBox(value)
        if !property.unknown {
            walkSigils(box, element: property.owner?.id, property: property.name)
        }
        property.appendValue(box)
        if isAtom(value) {
            return nil
        }
        let node = Node(.value(box), owner: property.owner, name: property.name, unknown: property.unknown)
        // Known in its parent and in itself, as an element head is.
        property.local[value.format()] = node
        node.local[value.format()] = node
        return node
    }

    /// Whether an unknown path may be declared in an element (projection.md).
    func declarable(_ context: Node, _ path: Link) -> Bool {
        if path.id != nil {
            return true
        }
        if isPath(path) {
            let key = path.values[0].format()
            return context.local[key] != nil || global[key] != nil || declarable(context, path.values[0])
        }
        let head = path.values.first?.id ?? ""
        let spec = context.element?.kind.flatMap { vocabulary.kinds[$0] }
        return vocabulary.kinds[head] != nil || spec?.properties[head] != nil
    }

    /// Path folding: (P v1 v2 ...) where P is a head or a known path.
    func fold(_ context: Node, _ link: Link) -> Node? {
        let first = link.values[0]
        let key = first.format()
        let wrapper = isGroupWrapper(link)
        var target = wrapper ? nil : (context.local[key] ?? global[key])
        if target == nil {
            if !wrapper && !declarable(context, first) {
                // Not foldable: keep the whole link verbatim, once.
                let element = context.element!
                warn("unknown-sublink", ["element": UiDiagnosticValue(element.id), "head": .null])
                element.unknown.append(ValueBox(link))
                return nil
            }
            target = append(context, first)
        }
        guard let target else { return nil }
        for value in link.values.dropFirst() {
            if let created = append(target, value) {
                global[Link(values: [first, value]).format()] = created
            }
        }
        return target
    }

    func checkSigil(_ text: String, element: String?, property: String?) {
        if text.hasPrefix("@") || text.hasPrefix("$") {
            var at: [String: UiDiagnosticValue] = ["element": UiDiagnosticValue(element)]
            if let property { at["property"] = .string(property) }
            warn("reserved-sigil", at)
        }
    }

    func walkSigils(_ box: ValueBox, element: String?, property: String?) {
        if let atom = box.atom {
            checkSigil(atom, element: element, property: property)
        } else {
            for item in box.items { walkSigils(item, element: element, property: property) }
        }
    }
}
