package foundation.link.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import foundation.link.ui.tokens.Tokens
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/* Token resolution: the default theme of #19, a theme read at run time with the parser of #31, fallbacks, and missing or cyclic tokens as diagnostics. */
class ThemeTest {
    private val tokensLino = File(repositoryRoot, "docs/case-studies/issue-1/samples/tokens.lino")

    @Test
    fun spaceMediumResolvesThroughTheDefaultTheme() {
        val diagnostics = ArrayList<UiDiagnostic>()
        val value = UiTheme.Default.resolve(UiValue.Group(null, listOf(UiValue.Atom("token"), UiValue.Atom("space.medium"))), diagnostics)
        assertEquals(TokenValue.Dimension(16.dp), value)
        assertEquals(emptyList(), diagnostics)
        assertEquals("16", renderTree("(body: stack (gap (token space.medium)))").roots[0].prop("spacing"))
    }

    @Test
    fun defaultThemeIsTheGeneratedKotlinTokens() {
        val theme = UiTheme.Default
        assertEquals("material3", theme.id)
        assertEquals(Tokens.ColorPrimary, theme.colorToken("color.primary"))
        assertEquals(Color(0xFF6750A4), theme.colorToken("color.primary"))
        assertEquals(Color.White, theme.colorToken("color.on-primary"))
        assertEquals(TokenValue.Dimension(Tokens.SpaceMedium), theme.token("space.medium"))
        assertEquals(TokenValue.Dimension(12.dp), theme.token("shape.corner.medium"))
        assertEquals(TokenValue.Duration(150), theme.token("motion.duration.short"))
    }

    /** Tokens.kt is the #19 Kotlin output for tokens.lino (the ui-tokens golden file) with a package line. */
    @Test
    fun generatedTokensAreTheUiTokensGoldenOutput() {
        val golden = File(repositoryRoot, "packages/ui-tokens/tests/golden/Tokens.kt").readText()
        val ours = File("src/commonMain/kotlin/foundation/link/ui/tokens/Tokens.kt").readText()
        assertEquals("package foundation.link.ui.tokens\n\n$golden", ours)
    }

    @Test
    fun tokensLinoLoadedAtRunTimeEqualsTheDefault() {
        val theme = UiTheme.fromLino(tokensLino.readText(), base = null)
        assertEquals("material3", theme.id)
        assertEquals(UiTheme.Default.tokens, theme.tokens)
        // `(extends base)` names a set the file does not have: a warning, not an exception.
        assertEquals(listOf("unknown-set"), theme.diagnostics.map { it.code })
        assertEquals(Severity.WARNING, theme.diagnostics[0].severity)
    }

    @Test
    fun missingTokenIsADiagnosticNotAnException() {
        val tree = renderTree("(body: stack (gap (token space.huge)))")
        assertNull(tree.roots[0].prop("spacing"))
        assertEquals(
            listOf(UiDiagnostic("unresolved-token", Severity.WARNING, mapOf("element" to "body", "property" to "gap", "token" to "space.huge"))),
            tree.diagnostics,
        )
        val theme = UiTheme.fromLino("(t: theme (token a (token nowhere)))")
        assertNull(theme.token("a"))
        assertEquals(listOf("unresolved-token"), theme.diagnostics.map { it.code })
    }

    @Test
    fun fallbackTakesTheFirstThatResolves() {
        val tree = renderTree("(s: stack (gap (or (token space.large) (token space.medium) 8px)))")
        assertEquals("16", tree.roots[0].prop("spacing"))
        assertEquals(emptyList(), tree.diagnostics)
        assertEquals("8", renderTree("(s: stack (gap (or (token space.large) 8px)))").roots[0].prop("spacing"))
        val none = renderTree("(s: stack (gap (or (token a) (token b))))")
        assertEquals(listOf("a", "b"), none.diagnostics.map { it.at["token"] })
    }

    @Test
    fun runTimeThemeOverridesAndExtends() {
        val theme = UiTheme.fromLino(
            """
            (compact: theme (extends material3) (token space.medium 8px) (token space.small (token space.medium)))
            (material3: theme (token color.primary '#000000'))
            """.trimIndent(),
        )
        assertEquals("compact", theme.id)
        assertEquals(TokenValue.Dimension(8.dp), theme.token("space.medium"))
        assertEquals(Color.Black, theme.colorToken("color.primary"), "the extended set comes before the base")
        assertEquals(TokenValue.Dimension(12.dp), theme.token("shape.corner.medium"), "the default theme is the base")
        assertEquals(TokenValue.Dimension(8.dp), theme.token("space.small"))
        assertEquals(emptyList(), theme.diagnostics)
        assertEquals("8", renderTree(parseDocument("(s: stack (gap (token space.small)))"), theme).roots[0].prop("spacing"))
    }

    @Test
    fun darkModeReplacesTheSetsTokens() {
        val text = "(m3: theme (token color.primary '#6750A4') (mode dark (token color.primary '#D0BCFF')))"
        val light = UiTheme.fromLino(text)
        val dark = UiTheme.fromLino(text, mode = "dark")
        assertEquals(Color(0xFF6750A4), light.colorToken("color.primary"))
        assertEquals(Color(0xFFD0BCFF), dark.colorToken("color.primary"))
        assertTrue(dark.dark)
        assertEquals(emptyList(), dark.diagnostics)
        assertEquals(Color(0xFFD0BCFF), dark.colorScheme().primary)
    }

    @Test
    fun cycleIsADiagnosticNotAnException() {
        val theme = UiTheme.fromLino("(loop: theme (token a (token b)) (token b (token a)))")
        assertNull(theme.token("a"))
        assertTrue(theme.diagnostics.any { it.code == "reference-cycle" })
    }

    @Test
    fun themeErrorsAreDiagnostics() {
        assertEquals(listOf("unknown-set"), UiTheme.fromLino("(a: text Hi)").diagnostics.map { it.code })
        assertEquals(listOf("unknown-set"), UiTheme.fromLino("(a: theme)", setId = "b").diagnostics.map { it.code })
        val broken = UiTheme.fromLino("(a: theme")
        assertEquals("syntax-error", broken.diagnostics.first().code)
        assertEquals(UiTheme.Default.tokens, broken.tokens, "a broken theme falls back to the base")
    }

    @Test
    fun typedValues() {
        assertEquals(TokenValue.Dimension(0.dp), parseLiteral("0"))
        assertEquals(TokenValue.Dimension(24.dp), parseLiteral("1.5rem"))
        assertEquals(TokenValue.Text("50%"), parseLiteral("50%"))
        assertEquals(TokenValue.Number(16.0), parseLiteral("16"))
        assertEquals(TokenValue.Duration(200), parseLiteral("0.2s"))
        assertEquals(TokenValue.ColorValue(Color.Red), parseLiteral("#f00"))
        assertEquals(TokenValue.Text("#12345"), parseLiteral("#12345"))
        assertEquals("16", numberText(16.0))
        assertEquals("1.5", numberText(1.5))
        val rgb = UiTheme.Default.resolve(parseDocument("(x: text (value (rgb 255 0 0)))").elements[0].prop("value")!![0])
        assertEquals(TokenValue.ColorValue(Color.Red), rgb)
    }
}
