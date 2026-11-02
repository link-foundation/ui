package io.github.linkfoundation.linksnotation

import kotlin.test.Test
import kotlin.test.assertTrue

/** The upstream parity corpus (`native/parity/text-fixtures.json`). */
class ParityTest {
    @Test
    fun everyCorpusCaseReadsAndFormatsLikeJavaScript() {
        assertTrue(PARITY_CASES.isNotEmpty())
        for (case in PARITY_CASES) {
            assertCase(case)
        }
    }
}
