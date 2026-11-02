package io.github.linkfoundation.linksnotation

/**
 * A link: an optional [id] and the links it holds, its [values].
 *
 * `id == null` marks an anonymous link, and a link without values is a
 * reference. Two links are equal when their ids and values are equal; how a
 * link was read does not take part in equality.
 */
data class Link(val id: String?, val values: List<Link> = emptyList()) {
    /**
     * Set on the links the parser builds from an indentation path (a line and
     * the lines indented under it). Such a link writes every value in
     * parentheses, exactly like the JavaScript `Link`.
     */
    internal var isFromPathCombination: Boolean = false

    /** The link as Links Notation text, the same text as JavaScript `Link.format()`. */
    fun format(): String = format(lessParentheses = false)

    /**
     * The link as Links Notation text. With [lessParentheses], the outer
     * parentheses are left out where the text still reads back the same,
     * like JavaScript `Link.format(true)`.
     */
    fun format(lessParentheses: Boolean): String = formatLink(this, lessParentheses, isCompoundValue = false)
}
