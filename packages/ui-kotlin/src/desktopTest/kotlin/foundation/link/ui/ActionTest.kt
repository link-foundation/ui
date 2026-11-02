package foundation.link.ui

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/* Behaviour: handlers are data handed to the host, never executed, and unsafe navigation targets are rejected (docs/spec/behaviour.md). */
class ActionTest {
    private fun fixture(path: String) = File(fixturesDirectory, path).readText()

    @Test
    fun pressingOkSendsTheNavigateAction() {
        val text = File(repositoryRoot, "docs/case-studies/issue-1/samples/document.lino").readText()
        val ok = renderTree(text).node("ok")!!
        val received = ArrayList<UiAction>()
        ok.fire("press") { received += it }
        assertEquals(listOf(UiAction("ok", "press", listOf("navigate", "home"))), received)
        assertEquals(emptyList(), ok.fire("hover"), "an event without a handler does nothing")
    }

    @Test
    fun javascriptTargetIsRejected() {
        for (target in listOf("'javascript:alert(1)'", "'  JavaScript:alert(1)'", "'data:text/html,hi'", "'vbscript:x'")) {
            val tree = renderTree("(evil: button Click (on press (navigate $target)))")
            assertEquals(emptyList(), tree.node("evil")!!.fire("press"), target)
            assertTrue(
                UiDiagnostic("unsafe-url", Severity.ERROR, mapOf("element" to "evil", "property" to "on")) in tree.diagnostics,
                target,
            )
        }
        assertTrue(isUnsafeUrl(" javascript:void(0)"))
        assertFalse(isUnsafeUrl("https://example.com/javascript:"))
        assertEquals(emptyList(), renderTree(fixture("behaviour/unsafe-url.lino")).node("evil")!!.handlers)
    }

    @Test
    fun javascriptImageSourceIsRejected() {
        val tree = renderTree("(pic: image (source 'javascript:alert(1)'))")
        assertEquals(null, tree.node("pic")!!.prop("url"))
        // The projection reports the value as `invalid-value` (not a url); the renderer drops it as `unsafe-url`.
        assertEquals(listOf("invalid-value", "unsafe-url"), tree.diagnostics.map { it.code })
    }

    @Test
    fun stringsAreNeverExecuted() {
        val tree = renderTree("(bad: button Bad (on press 'alert(1)'))\n(run: button Run (on press (eval 'alert(1)')))")
        assertEquals(emptyList(), tree.node("bad")!!.handlers)
        assertEquals(emptyList(), tree.node("run")!!.handlers)
        assertEquals(setOf("invalid-handler", "unknown-action"), tree.diagnostics.map { it.code }.toSet())
    }

    @Test
    fun severalActionsRunInOrder() {
        val save = renderTree(fixture("behaviour/several-actions.lino")).node("save")!!
        assertEquals(
            listOf(listOf("set", "status", "value", "Saving"), listOf("emit", "save"), listOf("toggle", "menu", "open"), listOf("focus", "status")),
            save.fire("press").map { it.action },
        )
    }

    @Test
    fun safeNavigationIsKept() {
        val docs = renderTree(fixture("behaviour/navigate.lino")).node("docs-link")!!
        assertEquals(listOf(UiAction("docs-link", "press", listOf("navigate", "https://example.com/docs"))), docs.fire("press"))
    }
}
