package io.github.linkfoundation.linksnotation

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The ui-dialect/0 parser vectors (`docs/spec/parser-vectors.json`), F03. */
class SpecVectorsTest {
    @Test
    fun everyVectorReadsAndFormatsLikeJavaScript() {
        assertTrue(SPEC_VECTORS.size >= 30)
        for (case in SPEC_VECTORS.filter { !it.error }) {
            assertCase(case, SPEC_OPTIONS)
        }
    }

    @Test
    fun everyErrorVectorIsRefusedWhereJavaScriptRefusesIt() {
        val errors = SPEC_VECTORS.filter { it.error }
        assertEquals(
            listOf("errors/syntax-colon-in-value", "errors/syntax-depth-exceeded", "errors/syntax-unquoted-hex"),
            errors.map { it.id },
        )
        for (case in errors) {
            assertCase(case, SPEC_OPTIONS)
        }
    }
}
