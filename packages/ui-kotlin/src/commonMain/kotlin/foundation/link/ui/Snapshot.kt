package foundation.link.ui

import io.github.linkfoundation.linksnotation.Link

/*
 * The render tree written as Links Notation, for snapshot tests that compare
 * the Kotlin renderer with the Swift one (#30). Every link is written with the
 * Links Notation formatter, so a value is quoted exactly when the formatter
 * quotes it. The tree is written in the nested form (#133): one node per line,
 * without the parentheses around the node, its children indented under it:
 *
 *     app: Column (scroll vertical)
 *       body: Column (spacing 16)
 *         greeting: Text 'Hello, links'
 *         ok: Button (label OK)
 */

/** The node without its children, as one link: `(ok: Button (label OK))`. */
fun RenderNode.headLink(): Link {
    val values = ArrayList<Link>()
    values += Link(primitive)
    if (!text.isNullOrEmpty()) values += Link(text)
    for ((name, value) in props) values += Link(null, listOf(Link(name), Link(value)))
    return Link(id, values)
}

/**
 * The node and its children in the nested form: one node per line, without
 * the parentheses around the node, children indented by two spaces.
 */
fun dumpLino(node: RenderNode, indent: String = ""): String {
    val head = node.headLink().format()
    // A line of the indented form is a link already: its outer parentheses are left out.
    val line = indent + if (head.startsWith("(") && head.endsWith(")")) head.substring(1, head.length - 1) else head
    if (node.children.isEmpty()) return line
    return line + "\n" + node.children.joinToString("\n") { dumpLino(it, "$indent  ") }
}

/** The whole tree as Links Notation, one root after another, ending with a newline. */
fun dumpLino(tree: RenderTree): String = tree.roots.joinToString("\n") { dumpLino(it) } + "\n"
