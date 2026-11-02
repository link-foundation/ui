package io.github.linkfoundation.linksnotation

/**
 * Reads Links Notation text into [Link]s, exactly as the JavaScript reference
 * parser (`links-notation` on npm) does: the same links for every document it
 * reads, and the same line and column for every document it refuses.
 */
class Parser(val options: ParserOptions = ParserOptions()) {
    /**
     * The links of [text].
     *
     * @throws ParseException.InputTooLarge when [text] is longer than the
     *   options allow; it is not read.
     * @throws ParseException.DepthExceeded when links nest deeper than
     *   [ParserOptions.maxDepth].
     * @throws ParseException.Syntax when [text] is not Links Notation.
     */
    fun parse(text: String): List<Link> {
        val limit = options.maxInputSize ?: ParserOptions.DEFAULT_MAX_INPUT_SIZE
        if (text.length > limit) {
            throw ParseException.InputTooLarge(limit)
        }

        // Comments are blanked rather than removed, so a position in the
        // prepared document is the same position in the document as written.
        val prepared = if (options.comments) stripComments(text) else text
        val raw =
            try {
                Grammar(prepared, options.maxDepth).parse()
            } catch (error: GrammarError) {
                throw toParseException(text, error)
            }
        val links = ArrayList<Link>()
        for (item in raw) {
            collectLinks(item, emptyList(), links)
        }
        return links
    }

    private fun collectLinks(item: RawItem, parentPath: List<Link>, result: MutableList<Link>) {
        val children = item.children
        if (children.isNullOrEmpty()) {
            result.add(combinePathElements(parentPath, transformLink(item)))
            return
        }
        if (item.id != null && item.values.isNullOrEmpty()) {
            // An ID with indented lines under it: those lines are its values.
            val link = Link(item.id, children.map(::transformIndentedValue))
            result.add(combinePathElements(parentPath, link))
            return
        }
        val current = transformLink(item)
        result.add(combinePathElements(parentPath, current))
        val path = parentPath + current
        for (child in children) {
            collectLinks(child, path, result)
        }
    }

    // A line below an indented ID is a value in its own right. Bare single
    // references unwrap, but named links and descendants keep their structure.
    private fun transformIndentedValue(item: RawItem): Link {
        val children = item.children.orEmpty()
        if (children.isNotEmpty() && item.id != null && item.values.isNullOrEmpty()) {
            return Link(item.id, children.map(::transformIndentedValue))
        }
        val current = transformLink(item)
        if (children.isNotEmpty()) {
            return Link(current.id, current.values + children.map(::transformIndentedValue))
        }
        if (item.id == null && item.nested == null && current.values.size == 1) {
            return current.values[0]
        }
        return current
    }

    private fun combinePathElements(path: List<Link>, current: Link): Link {
        if (path.isEmpty()) return current
        val parent = if (path.size == 1) path[0] else combinePathElements(path.dropLast(1), path.last())
        return Link(null, listOf(parent, current)).also { it.isFromPathCombination = true }
    }

    // A group holding one link is that link; a group holding several, or one
    // group, is an anonymous link of them, so `((a b))` stays apart from `(a b)`.
    private fun transformNested(nested: List<RawItem>): Link {
        val links = ArrayList<Link>()
        for (item in nested) {
            collectLinks(item, emptyList(), links)
        }
        val wrapsSingleGroup = nested.size == 1 && nested[0].nested != null
        if (links.size == 1 && !wrapsSingleGroup) {
            return links[0]
        }
        return Link(null, links)
    }

    private fun transformLink(item: RawItem): Link {
        val nested = item.nested
        if (nested != null) return transformNested(nested)
        val values = item.values ?: return Link(item.id)
        return Link(item.id, values.map(::transformLink))
    }

    private fun toParseException(text: String, error: GrammarError): ParseException {
        val position = positionAt(text, error.offset)
        val lineText = lineAt(text, position.offset)
        val summary = "line ${position.line}, column ${position.column}: ${error.message}"
        val snippet = quoteLine(position.line, lineText, position.column)
        val depthLimit = error.depthLimit
        if (depthLimit != null) {
            return ParseException.DepthExceeded(
                depthLimit,
                position.line,
                position.column,
                "Nesting too deep at $summary\n$snippet",
            )
        }
        return ParseException.Syntax(position.line, position.column, "Syntax error at $summary\n$snippet")
    }
}
