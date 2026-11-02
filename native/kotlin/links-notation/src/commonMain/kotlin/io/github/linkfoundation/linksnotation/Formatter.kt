package io.github.linkfoundation.linksnotation

/**
 * The links as Links Notation text, one link per line: the same text as
 * JavaScript `formatLinks(links)`. Parsing the result gives the same links back.
 */
fun formatLinks(links: List<Link>): String = formatLinks(links, lessParentheses = false)

/** The links as Links Notation text, like JavaScript `formatLinks(links, lessParentheses)`. */
fun formatLinks(links: List<Link>, lessParentheses: Boolean): String =
    links.joinToString("\n") { it.format(lessParentheses) }

/** Port of `Link.format(lessParentheses, isCompoundValue)` of `js/src/Link.js`. */
internal fun formatLink(link: Link, lessParentheses: Boolean, isCompoundValue: Boolean): String {
    val id = link.id
    val values = link.values

    // Empty link
    if (id == null && values.isEmpty()) {
        return if (lessParentheses) "" else "()"
    }

    // Link with only an ID
    if (values.isEmpty()) {
        val escapedId = escapeReference(id)
        if (isCompoundValue) {
            return "($escapedId)"
        }
        return if (lessParentheses && !needsParentheses(id)) escapedId else "($escapedId)"
    }

    val valuesText = values.joinToString(" ") { formatValue(link, it) }

    // Link with values only
    if (id == null) {
        if (lessParentheses) {
            if (values.all { it.values.isEmpty() }) {
                return values.joinToString(" ") { escapeReference(it.id) }
            }
            return valuesText
        }
        return "($valuesText)"
    }

    // Link with an ID and values
    val withColon = "${escapeReference(id)}: $valuesText"
    return if (lessParentheses && !needsParentheses(id)) withColon else "($withColon)"
}

/** Port of `Link.formatValue(value)`: how [value] is written inside [parent]. */
private fun formatValue(parent: Link, value: Link): String {
    if (parent.isFromPathCombination) {
        return formatLink(value, lessParentheses = false, isCompoundValue = true)
    }
    if (value.values.isEmpty()) {
        return escapeReference(value.id)
    }
    return formatLink(value, lessParentheses = false, isCompoundValue = false)
}

/** Port of `Link.needsParentheses(str)`. */
private fun needsParentheses(text: String?): Boolean =
    !text.isNullOrEmpty() &&
        (text.contains(' ') || text.contains(':') || text.contains('(') || text.contains(')'))
