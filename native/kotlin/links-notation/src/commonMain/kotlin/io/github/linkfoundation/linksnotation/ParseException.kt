package io.github.linkfoundation.linksnotation

/**
 * Why a document could not be read.
 *
 * Line and column numbers count from 1. Columns count UTF-16 code units, the
 * unit `String.length` counts in Kotlin and in the JavaScript reference parser,
 * so a position reported here is the position the JavaScript parser reports.
 */
sealed class ParseException(message: String) : Exception(message) {
    /**
     * The document cannot be read at [line] and [column]: the furthest
     * position the parser reached, exactly as the JavaScript reference reports
     * it. Every refusal of a document that was read is a [Syntax] error; the
     * one for links nested too deep is the more specific [DepthExceeded].
     */
    open class Syntax(val line: Int, val column: Int, message: String) : ParseException(message)

    /**
     * Links nest deeper than [limit] levels: every parenthesised group and
     * every indentation level is one level. [line] and [column] point at the
     * group or line that went too deep (0 when unknown). Like the JavaScript
     * reference, which refuses such a document with the same `ParseError` as
     * any other, this is a [Syntax] error too.
     */
    class DepthExceeded(
        val limit: Int,
        line: Int = 0,
        column: Int = 0,
        message: String = "nesting depth exceeds the maximum of $limit",
    ) : Syntax(line, column, message)

    /** The document is longer than [limit] UTF-16 code units; it was not read. */
    class InputTooLarge(val limit: Int) :
        ParseException("Input size exceeds maximum allowed size of $limit bytes")
}
