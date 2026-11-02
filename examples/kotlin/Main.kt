// The ui-kotlin example (issue #32): renders a ui-dialect/0 document with
// UiView in a Compose Desktop window, or into a PNG with --screenshot.
//
//     cd examples/kotlin
//     ../../packages/ui-kotlin/gradlew run
//     ../../packages/ui-kotlin/gradlew run --args="--dark"
//     ../../packages/ui-kotlin/gradlew run --args="--screenshot out.png --dark"
//     ../../packages/ui-kotlin/gradlew run --args="--document path/to/other.lino"

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.use
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import foundation.link.ui.UiAction
import foundation.link.ui.UiDocumentState
import foundation.link.ui.UiTheme
import foundation.link.ui.UiView
import foundation.link.ui.colorScheme
import org.jetbrains.skia.EncodedImageFormat
import java.io.File

private class Options(args: Array<String>) {
    var document = File(System.getProperty("ui.kotlin.document") ?: "docs/case-studies/issue-1/samples/document.lino")
    var theme = System.getProperty("ui.kotlin.theme")?.let(::File)
    var dark = false
    var screenshot: File? = null

    init {
        val rest = args.iterator()
        while (rest.hasNext()) {
            when (val arg = rest.next()) {
                "--dark" -> dark = true
                "--document" -> document = File(rest.next())
                "--theme" -> theme = File(rest.next())
                "--screenshot" -> screenshot = File(rest.next())
                else -> error("unknown argument $arg; use --document FILE, --theme FILE, --dark, --screenshot FILE")
            }
        }
    }
}

/** The document, the last action it sent, and the diagnostics. */
@Composable
private fun Demo(state: UiDocumentState, theme: UiTheme) {
    var last by remember { mutableStateOf<UiAction?>(null) }
    MaterialTheme(colorScheme = theme.colorScheme()) {
        Surface(Modifier.fillMaxSize()) {
            Column {
                UiView(
                    state,
                    Modifier.padding(24.dp),
                    theme = theme,
                    onAction = { action ->
                        println("action: $action")
                        last = action
                    },
                    onDiagnostics = { it.forEach { diagnostic -> System.err.println("diagnostic: $diagnostic") } },
                )
                HorizontalDivider()
                Text(
                    last?.let { "Last action: ${it.event} on ${it.source} -> ${it.action.joinToString(" ")}" }
                        ?: "Press OK: the action is sent to the host as data.",
                    Modifier.padding(24.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

fun main(args: Array<String>) {
    val options = Options(args)
    val state = UiDocumentState(options.document.readText())
    state.projectionDiagnostics.forEach { System.err.println("diagnostic: $it") }
    // The theme is read at run time with the Links Notation parser; without a
    // theme file the generated Kotlin tokens (UiTheme.Default) are used.
    val theme = options.theme?.let { UiTheme.fromLino(it.readText(), mode = if (options.dark) "dark" else null) }
        ?: UiTheme.Default
    theme.diagnostics.forEach { System.err.println("theme diagnostic: $it") }

    val screenshot = options.screenshot
    if (screenshot != null) {
        ImageComposeScene(width = 960, height = 640, density = Density(2f)) { Demo(state, theme) }.use { scene ->
            scene.render() // the first frame lays out; the second draws it settled
            val image = scene.render(1_000_000_000L)
            val png = image.encodeToData(EncodedImageFormat.PNG) ?: error("could not encode the screenshot")
            screenshot.absoluteFile.parentFile.mkdirs()
            screenshot.writeBytes(png.bytes)
        }
        println("wrote ${screenshot.path}")
        return
    }

    application {
        Window(
            onCloseRequest = ::exitApplication,
            title = "ui-kotlin: ${options.document.name}",
            state = rememberWindowState(size = DpSize(480.dp, 360.dp)),
        ) {
            Demo(state, theme)
        }
    }
}
