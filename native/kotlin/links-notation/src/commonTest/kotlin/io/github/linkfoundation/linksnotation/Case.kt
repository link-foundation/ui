package io.github.linkfoundation.linksnotation

/**
 * One parity case or parser vector, as `generateParityCases` writes it into
 * `ParityCases.kt`. A case with [error] has no [expected] and no [format]; it
 * has the diagnostic [code] of docs/spec/limits.md and the [line] and [column]
 * the JavaScript reference parser reports, and the parser vectors also give the
 * reference [message], which the error message must contain.
 */
internal data class Case(
    val id: String,
    val input: String,
    val expected: List<Link>?,
    val format: String?,
    val error: Boolean = false,
    val code: String? = null,
    val line: Int = 0,
    val column: Int = 0,
    val message: String? = null,
)
