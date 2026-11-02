package foundation.link.ui

import io.github.linkfoundation.linksnotation.Link

/*
 * The render tree written as Links Notation, for snapshot tests that compare
 * the Kotlin renderer with the Swift one (#30). Every link is written with the
 * Links Notation formatter, so a value is quoted exactly when the formatter
 * quotes it; the only text added here is the indentation of the children and
 * the closing parentheses:
 *
 *     (app: Column (scroll vertical)
 *       (body: Column (spacing 16)
 *         (greeting: Text 'Hello, links')
 *         (ok: Button (label OK))))
 */

/** The node without its children, as one link: `(ok: Button (label OK))`. */
fun RenderNode.headLink(): Link {
    val values = ArrayList<Link>()
    values += Link(primitive)
    if (!text.isNullOrEmpty()) values += Link(text)
    for ((name, value) in props) values += Link(null, listOf(Link(name), Link(value)))
    return Link(id, values)
}

/** The node and its children, one node per line, children indented by two spaces. */
fun dumpLino(node: RenderNode, indent: String = ""): String {
    val head = node.headLink().format()
    if (node.children.isEmpty()) return indent + head
    val lines = node.children.joinToString("\n") { dumpLino(it, "$indent  ") }
    // `head` ends with the `)` that closes the node; it moves after the children.
    return indent + head.dropLast(1) + "\n" + lines + ")"
}

/** The whole tree as Links Notation, one root after another, ending with a newline. */
fun dumpLino(tree: RenderTree): String = tree.roots.joinToString("\n") { dumpLino(it) } + "\n"
