package foundation.link.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Loads the image at a URL; null draws an empty box of the image's size. No network library is bundled. */
typealias UiImageLoader = @Composable (url: String) -> Painter?

/**
 * Draws [document] with Material 3 components (see the mapping table in
 * `RenderTree.kt` and the README). Every element with an id gets
 * `Modifier.testTag(id)`; buttons and images carry the semantics roles
 * `Button` and `Image`. A press runs the button's `(on press ...)` actions:
 * each one is passed to [onAction] as data and never executed.
 * [onDiagnostics] receives the diagnostics of the projection and of the
 * render tree (an unknown kind, an unresolved token, a dropped handler).
 */
@Composable
fun UiView(
    document: UiDocumentState,
    modifier: Modifier = Modifier,
    theme: UiTheme = UiTheme.Default,
    onAction: (UiAction) -> Unit = {},
    imageLoader: UiImageLoader = { null },
    onDiagnostics: (List<UiDiagnostic>) -> Unit = {},
) {
    LaunchedEffect(document, theme) {
        onDiagnostics(renderTree(document.snapshot(), theme).diagnostics)
    }
    MaterialTheme(colorScheme = remember(theme) { theme.colorScheme() }) {
        Surface(modifier) {
            Column {
                for (slot in document.roots) Element(slot, theme, onAction, imageLoader)
            }
        }
    }
}

/** The Material 3 colour scheme of [UiTheme], with `color.primary` and `color.on-primary` when set. */
fun UiTheme.colorScheme(): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = colorToken("color.primary") ?: base.primary,
        onPrimary = colorToken("color.on-primary") ?: base.onPrimary,
    )
}

/** One element, drawn from its own state: a change to it redraws only it. */
@Composable
private fun Element(slot: UiElementSlot, theme: UiTheme, onAction: (UiAction) -> Unit, imageLoader: UiImageLoader) {
    val node = slot.node
    val head = remember(node, theme) { renderHead(node, theme) }
    val tagged = head.id?.let { Modifier.testTag(it) } ?: Modifier
    val children: @Composable () -> Unit = { for (child in slot.children) Element(child, theme, onAction, imageLoader) }
    val spacing = Arrangement.spacedBy((head.prop("spacing")?.toFloat() ?: 0f).dp)
    val padding = Modifier.padding((head.prop("padding")?.toFloat() ?: 0f).dp)
    when (head.primitive) {
        "Column" -> {
            val scroll = if (head.prop("scroll") != null) Modifier.verticalScroll(rememberScrollState()) else Modifier
            val title = head.label
            val pane = if (title != null) Modifier.semantics { paneTitle = title } else Modifier
            val alignment = when (head.prop("alignment")) {
                "Start" -> Alignment.Start
                "End" -> Alignment.End
                "CenterHorizontally" -> Alignment.CenterHorizontally
                else -> Alignment.Start
            }
            Column(tagged.then(pane).then(scroll).then(padding), spacing, alignment) { children() }
        }
        "Row" -> {
            val alignment = when (head.prop("alignment")) {
                "Bottom" -> Alignment.Bottom
                "CenterVertically" -> Alignment.CenterVertically
                else -> Alignment.Top
            }
            Row(tagged.then(padding), spacing, alignment) { children() }
        }
        "Text" -> Text(head.text.orEmpty(), tagged)
        "Button" -> {
            val onClick = { head.fire("press", onAction); Unit }
            val enabled = head.prop("disabled") != "true"
            val button = tagged.semantics { role = Role.Button }
            val label: @Composable () -> Unit = { Text(head.prop("label").orEmpty()) }
            when (head.prop("variant")) {
                "outlined" -> OutlinedButton(onClick, button, enabled) { label() }
                "text" -> TextButton(onClick, button, enabled) { label() }
                else -> Button(onClick, button, enabled) { label() }
            }
        }
        "Image" -> {
            val size = Modifier.size((head.prop("width")?.toFloat() ?: 48f).dp, (head.prop("height")?.toFloat() ?: 48f).dp)
            val alt = head.label
            val image = tagged.then(size).semantics {
                role = Role.Image
                if (alt != null) contentDescription = alt
            }
            val painter = head.prop("url")?.let { imageLoader(it) }
            if (painter != null) Image(painter, alt, image) else Box(image)
        }
        else -> Box(tagged)
    }
}
