// The observable state UiView draws: one `UiElementModel` per element, so a
// `setProp` on one element invalidates only the view of that element.

import Observation
import UiSwiftCore

/// One element: its own properties (without its children) and the models of its children.
@Observable
public final class UiElementModel: Identifiable {
    /// The element without its children; the views of the children observe their own models.
    public private(set) var node: UiNode
    public private(set) var children: [UiElementModel]

    init(_ node: UiNode) {
        children = node.children.map(UiElementModel.init)
        var head = node
        head.children = []
        self.node = head
    }

    /// The element id.
    public var elementId: String? { node.id }

    /// Replace the last property `name` (or add it) with `values`.
    public func setProp(_ name: String, _ values: [UiValue]) {
        var updated = node
        if let index = updated.properties.lastIndex(where: { $0.name == name }) {
            updated.properties[index].values = values
        } else {
            updated.properties.append(UiProp(name: name, values: values))
        }
        node = updated
    }

    /// The element with its children, as the projection gave it.
    public var tree: UiNode {
        var full = node
        full.children = children.map(\.tree)
        return full
    }
}

/// A document for `UiView`: its element models and the projection's diagnostics.
@Observable
public final class UiDocumentModel {
    public private(set) var roots: [UiElementModel]
    /// Top-level links that are not elements, kept as the projection gave them.
    public let unknown: [UiValue]
    public let diagnostics: [UiDiagnostic]
    @ObservationIgnored private var byId: [String: UiElementModel] = [:]

    public init(document: UiDocument) {
        roots = document.elements.map(UiElementModel.init)
        unknown = document.unknown
        diagnostics = document.diagnostics
        func index(_ model: UiElementModel) {
            if let id = model.elementId, byId[id] == nil { byId[id] = model }
            model.children.forEach(index)
        }
        roots.forEach(index)
    }

    /// Project LiNo text (with the LinksNotation parser) into a model.
    public convenience init(lino text: String) {
        self.init(document: project(text))
    }

    public func element(id: String) -> UiElementModel? { byId[id] }

    /// Set a property of the element `id`; only that element's view is drawn again.
    /// - Returns: `false` when there is no such element.
    @discardableResult
    public func setProp(id: String, name: String, values: [UiValue]) -> Bool {
        guard let model = byId[id] else { return false }
        model.setProp(name, values)
        return true
    }

    /// The current document, for `RenderTree(document:)`.
    public var document: UiDocument {
        UiDocument(elements: roots.map(\.tree), unknown: unknown, diagnostics: diagnostics)
    }
}
