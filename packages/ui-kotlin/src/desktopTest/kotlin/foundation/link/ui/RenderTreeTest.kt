package foundation.link.ui

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/* Every row of the render mapping (README.md, "Render mapping") and the unsupported-kind diagnostic. */
class RenderTreeTest {
    private val sample = File(repositoryRoot, "docs/case-studies/issue-1/samples/document.lino")

    @Test
    fun sampleDocumentDumpsAsLinksNotation() {
        val tree = renderTree(sample.readText())
        assertEquals(
            """
            (app: Column (scroll vertical)
              (body: Column (spacing 16)
                (greeting: Text 'Hello, links')
                (ok: Button (label OK))))

            """.trimIndent(),
            dumpLino(tree),
        )
        assertEquals(emptyList(), tree.diagnostics)
    }

    @Test
    fun documentIsAScrollingColumnLabelledByItsTitle() {
        val node = renderTree("(app: document (title 'My app'))").roots[0]
        assertEquals("Column", node.primitive)
        assertEquals("vertical", node.prop("scroll"))
        assertEquals("My app", node.label)
    }

    @Test
    fun stackDirectionChoosesColumnOrRow() {
        val tree = renderTree("(v: stack (gap 8px) (padding 1rem) (align start))\n(h: stack (direction horizontal) (gap 4px) (align end))")
        val vertical = tree.node("v")!!
        assertEquals("Column", vertical.primitive)
        assertEquals(listOf("spacing" to "8", "padding" to "16", "alignment" to "Start"), vertical.props)
        val horizontal = tree.node("h")!!
        assertEquals("Row", horizontal.primitive)
        assertEquals(listOf("spacing" to "4", "alignment" to "Bottom"), horizontal.props)
        assertEquals("Column", renderTree("(s: stack)").roots[0].primitive, "vertical is the default")
        assertEquals("CenterVertically", renderTree("(s: stack (direction horizontal) (align center))").roots[0].prop("alignment"))
    }

    @Test
    fun textShowsItsValue() {
        val tree = renderTree("(a: text 'Hello, links')\n(b: text (value Bye))")
        assertEquals("Text", tree.node("a")!!.primitive)
        assertEquals("Hello, links", tree.node("a")!!.text)
        assertEquals("Hello, links", tree.node("a")!!.label)
        assertEquals("Bye", tree.node("b")!!.text)
    }

    @Test
    fun buttonHasItsLabelAndVariant() {
        val tree = renderTree("(a: button (label 'OK'))\n(b: button Save (disabled true) (variant outlined))\n(c: button C (variant filled))")
        assertEquals("Button", tree.node("a")!!.primitive)
        assertEquals(listOf("label" to "OK"), tree.node("a")!!.props)
        assertEquals("OK", tree.node("a")!!.label)
        assertEquals(listOf("label" to "Save", "variant" to "outlined", "disabled" to "true"), tree.node("b")!!.props)
        assertEquals(listOf("label" to "C"), tree.node("c")!!.props, "filled is the default Button")
    }

    @Test
    fun imageIsLabelledByAlt() {
        val image = renderTree("(logo: image 'https://example.com/logo.png' (alt 'Company logo') (width 64px) (height 2rem))").node("logo")!!
        assertEquals("Image", image.primitive)
        assertEquals("Company logo", image.label)
        assertEquals("https://example.com/logo.png", image.prop("url"))
        assertEquals("64", image.prop("width"))
        assertEquals("32", image.prop("height"))
        assertEquals("(logo: Image (url 'https://example.com/logo.png') (width 64) (height 32) (alt 'Company logo'))", dumpLino(image))
    }

    @Test
    fun imageWithAnUnsafeSourceHasNoUrl() {
        val tree = renderTree("(x: image (source 'javascript:alert(1)'))")
        assertNull(tree.node("x")!!.prop("url"))
        assertTrue(tree.diagnostics.any { it.code == "unsafe-url" && it.at["element"] == "x" })
    }

    @Test
    fun unknownKindIsAnEmptyBoxWithADiagnostic() {
        val tree = renderTree("(page: document (chart-1: chart (series 1 2 3) (inner: text Hidden)) (after: text Shown))")
        val chart = tree.node("chart-1")!!
        assertEquals("Box", chart.primitive)
        assertEquals(emptyList(), chart.children, "the children of an unsupported kind are not rendered")
        assertNull(tree.node("inner"))
        assertEquals("Text", tree.node("after")?.primitive)
        assertTrue(UiDiagnostic("unsupported-kind", Severity.WARNING, mapOf("element" to "chart-1", "kind" to "chart")) in tree.diagnostics)
        assertEquals("(chart-1: Box)", dumpLino(chart))
    }

    @Test
    fun knownButUnrenderedKindIsAnEmptyBox() {
        val tree = renderTree("(t: theme (token a 1px))")
        assertEquals("Box", tree.roots[0].primitive)
        assertEquals(listOf("unsupported-kind"), tree.diagnostics.map { it.code })
    }

    @Test
    fun everyNodeIsIdentifiedByItsLinkId() {
        assertEquals(listOf("app", "body", "greeting", "ok"), renderTree(sample.readText()).allNodes.map { it.id })
    }

    @Test
    fun anonymousElementsAreRendered() {
        assertEquals("(form: Column\n  (Text Name)\n  (Button (label Save)))\n", dumpLino(renderTree("(form: stack (text Name) (button Save))")))
    }

    @Test
    fun documentStateChangesOneElement() {
        val state = UiDocumentState(sample.readText())
        assertTrue(state.setProp("greeting", "value", "Hi"))
        assertEquals("Hi", renderTree(state.snapshot()).node("greeting")!!.text)
        assertEquals(false, state.setProp("missing", "value", "x"))
        assertEquals("OK", state["ok"]!!.propText("label"))
    }
}
