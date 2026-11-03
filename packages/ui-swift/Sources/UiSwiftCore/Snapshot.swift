// The render tree written as Links Notation (`dumpLino`), for snapshot tests
// that compare the Swift renderer with the other ports (#32). Every link is
// written with the LinksNotation formatter, so a value is quoted exactly when
// the formatter quotes it. The tree is written in the nested form (#133): one
// node per line, without the parentheses around the node, its children
// indented under it.
//
//     app: ScrollView
//       body: VStack (spacing 16)
//         greeting: Text 'Hello, links'
//         ok: Button (label OK)

import LinksNotation

extension UiValue {
    /// The value as a Links Notation link.
    public var link: Link {
        switch self {
        case .atom(let text): return Link(id: text)
        case .list(let values): return Link(values: values.map(\.link))
        case .link(let id, let values): return Link(id: id, values: values.map(\.link))
        }
    }

    /// The value as Links Notation text: an atom is escaped (`'Hello, links'`),
    /// a link is formatted (`(token space.medium)`).
    public var linoText: String {
        if case .atom(let text) = self { return escapeReference(text) }
        return link.format()
    }
}

extension RenderNode {
    /// The node without its children, as one link: `(ok: Button (label OK))`.
    public var headLink: Link {
        var values = [Link(id: primitive.rawValue)]
        if let text, !text.isEmpty { values.append(Link(id: text)) }
        for prop in props {
            values.append(Link(values: [Link(id: prop.name)] + prop.values.map(\.link)))
        }
        return Link(id: id, values: values)
    }

    /// The node and its children in the nested form: one node per line,
    /// without the parentheses around the node, children indented by two spaces.
    public func dumpLino(indent: String = "") -> String {
        let head = headLink.format()
        // A line of the indented form is a link already: its outer parentheses are left out.
        let line = indent + (head.hasPrefix("(") && head.hasSuffix(")") ? String(head.dropFirst().dropLast()) : head)
        guard !children.isEmpty else { return line }
        return line + "\n" + children.map { $0.dumpLino(indent: indent + "  ") }.joined(separator: "\n")
    }
}

extension RenderTree {
    /// The whole tree as Links Notation, one root after another, ending with a newline.
    public func dumpLino() -> String {
        roots.map { $0.dumpLino() }.joined(separator: "\n") + "\n"
    }
}
