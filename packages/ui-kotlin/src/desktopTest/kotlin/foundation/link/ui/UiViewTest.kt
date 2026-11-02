package foundation.link.ui

import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.v2.runComposeUiTest
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/* UiView in a headless Compose window: test tags, semantics roles, actions and state updates. */
@OptIn(ExperimentalTestApi::class)
class UiViewTest {
    private val sample = File(repositoryRoot, "docs/case-studies/issue-1/samples/document.lino").readText()

    private fun hasRole(role: Role) = SemanticsMatcher("role is $role") { it.config.getOrNull(SemanticsProperties.Role) == role }

    @Test
    fun clickingOkSendsTheNavigateAction() = runComposeUiTest {
        val received = ArrayList<UiAction>()
        setContent { UiView(UiDocumentState(sample), onAction = { received += it }) }
        onNodeWithTag("ok").performClick()
        assertEquals(listOf(UiAction("ok", "press", listOf("navigate", "home"))), received)
    }

    @Test
    fun everyElementIdHasATestTag() = runComposeUiTest {
        val state = UiDocumentState(sample)
        setContent { UiView(state) }
        val ids = renderTree(state.snapshot()).allNodes.mapNotNull { it.id }
        assertEquals(listOf("app", "body", "greeting", "ok"), ids)
        for (id in ids) onNodeWithTag(id).assertExists(id)
        onNodeWithTag("greeting").assertTextEquals("Hello, links")
    }

    @Test
    fun everyFixtureElementIdHasATestTag() = runComposeUiTest {
        val documents = renderableFixtures().map { UiDocumentState(it.second) }
        val index = androidx.compose.runtime.mutableIntStateOf(0)
        setContent { UiView(documents[index.intValue]) }
        for (i in documents.indices) {
            index.intValue = i
            waitForIdle()
            for (id in renderTree(documents[i].snapshot()).allNodes.mapNotNull { it.id }) {
                onNodeWithTag(id, useUnmergedTree = true).assertExists("fixture $i: $id")
            }
        }
    }

    @Test
    fun buttonsAndImagesHaveSemanticsRoles() = runComposeUiTest {
        val text = "(page: document (save: button Save (disabled true)) (logo: image 'https://example.com/logo.png' (alt Logo)))"
        setContent { UiView(UiDocumentState(text)) }
        onNodeWithTag("save").assert(hasRole(Role.Button)).assertIsNotEnabled()
        onNodeWithTag("logo").assert(hasRole(Role.Image))
        val description = onNodeWithTag("logo").fetchSemanticsNode().config.getOrNull(SemanticsProperties.ContentDescription)
        assertEquals(listOf("Logo"), description)
    }

    @Test
    fun unknownKindIsAnEmptyBoxAndADiagnostic() = runComposeUiTest {
        val diagnostics = ArrayList<UiDiagnostic>()
        val text = "(page: document (chart-1: chart (inner: text Hidden)) (after: text Shown))"
        setContent { UiView(UiDocumentState(text), onDiagnostics = { diagnostics += it }) }
        waitForIdle()
        onNodeWithTag("chart-1").assertExists()
        onNodeWithTag("inner").assertDoesNotExist()
        onNodeWithText("Shown").assertExists()
        assertTrue(UiDiagnostic("unsupported-kind", Severity.WARNING, mapOf("element" to "chart-1", "kind" to "chart")) in diagnostics)
    }

    @Test
    fun unsafeHandlerSendsNothing() = runComposeUiTest {
        val received = ArrayList<UiAction>()
        setContent { UiView(UiDocumentState("(evil: button Click (on press (navigate 'javascript:alert(1)')))"), onAction = { received += it }) }
        onNodeWithTag("evil").performClick()
        assertEquals(emptyList(), received)
    }

    @Test
    fun setPropRedrawsTheElement() = runComposeUiTest {
        val state = UiDocumentState(sample)
        setContent { UiView(state) }
        state.setProp("greeting", "value", "Bye")
        waitForIdle()
        onNodeWithTag("greeting").assertTextEquals("Bye")
    }

    @Test
    fun runTimeThemeIsApplied() = runComposeUiTest {
        val theme = UiTheme.fromLino("(compact: theme (extends material3) (token space.medium 4px))")
        val received = ArrayList<UiAction>()
        setContent { UiView(UiDocumentState(sample), theme = theme, onAction = { received += it }) }
        onNodeWithTag("ok").performClick()
        assertEquals(1, received.size)
        assertEquals("4", renderTree(parseDocument(sample), theme).node("body")!!.prop("spacing"))
    }
}
