package foundation.link.ui

/*
 * The platform-neutral render tree: what UiView draws, as data, so that it can
 * be tested without a window and compared with the Swift port (#30).
 *
 * | kind       | primitive        | from                                                              |
 * | ---------- | ---------------- | ----------------------------------------------------------------- |
 * | `document` | `Column`         | `(scroll vertical)`; `title` is the pane title                    |
 * | `stack`    | `Column` / `Row` | `direction`; `gap` -> `spacing`, `padding`, `align` -> `alignment` |
 * | `text`     | `Text`           | `value`, or the positional values                                 |
 * | `button`   | `Button`         | `label` (or positional), `variant`, `disabled`; `on` handlers     |
 * | `image`    | `Image`          | `source` -> `url`, `width`, `height`, `alt` -> content description |
 * | any other  | `Box`            | an `unsupported-kind` diagnostic; children are not rendered       |
 */

/** The kinds the renderer draws (every other kind is an empty `Box`). */
val RENDERED_KINDS: Set<String> = setOf("document", "stack", "text", "button", "image")

/** One drawn node. */
data class RenderNode(
    /** The element id (null for an anonymous element); it is the node's test tag. */
    val id: String?,
    /** The Compose primitive: `Column`, `Row`, `Text`, `Button`, `Image` or `Box`. */
    val primitive: String,
    /** The resolved properties, in a fixed order per primitive: `spacing` to `16`. */
    val props: List<Pair<String, String>> = emptyList(),
    val children: List<RenderNode> = emptyList(),
    /** The element kind. */
    val kind: String? = null,
    /** The text a `Text` shows. */
    val text: String? = null,
    /** What assistive technologies read (null keeps the platform default). */
    val label: String? = null,
    /** The checked `(on ...)` handlers. */
    val handlers: List<UiHandler> = emptyList(),
) {
    /** The value of the property [name], or null. */
    fun prop(name: String): String? = props.firstOrNull { it.first == name }?.second

    /** The actions an [event] runs, sent to [onAction] in order and returned. */
    fun fire(event: String, onAction: (UiAction) -> Unit = {}): List<UiAction> =
        handlers.actions(event, id).onEach(onAction)

    /** This node and its descendants, depth first. */
    val allNodes: List<RenderNode> get() = listOf(this) + children.flatMap { it.allNodes }
}

/** A rendered document: its roots and every diagnostic (the projection's first). */
data class RenderTree(val roots: List<RenderNode>, val diagnostics: List<UiDiagnostic>) {
    /** Every node, depth first. */
    val allNodes: List<RenderNode> get() = roots.flatMap { it.allNodes }

    /** The node with the id [id], or null. */
    fun node(id: String): RenderNode? = allNodes.firstOrNull { it.id == id }
}

/** Renders a projected document. */
fun renderTree(document: UiDocument, theme: UiTheme = UiTheme.Default, vocabulary: Vocabulary = Vocabulary.Default): RenderTree {
    val diagnostics = document.diagnostics.toMutableList()
    val roots = document.elements.map { renderTree(it, theme, diagnostics, vocabulary) }
    return RenderTree(roots, diagnostics)
}

/** Projects and renders LiNo text. */
fun renderTree(text: String, theme: UiTheme = UiTheme.Default): RenderTree = renderTree(parseDocument(text), theme)

/** Renders one element and its children; what it finds wrong goes to [diagnostics]. */
fun renderTree(
    node: UiNode,
    theme: UiTheme = UiTheme.Default,
    diagnostics: MutableList<UiDiagnostic> = ArrayList(),
    vocabulary: Vocabulary = Vocabulary.Default,
): RenderNode {
    val head = renderHead(node, theme, diagnostics, vocabulary)
    if (head.primitive == "Box") return head
    return head.copy(children = node.children.map { renderTree(it, theme, diagnostics, vocabulary) })
}

/** A number as the render tree writes it: `16`, not `16.0`. */
fun numberText(number: Double): String =
    if (number == kotlin.math.floor(number) && kotlin.math.abs(number) < 1e15) number.toLong().toString() else number.toString()

/**
 * Renders one element without its children: [UiView] draws each element
 * from its own state, so a change to one element redraws only that element.
 */
fun renderHead(
    node: UiNode,
    theme: UiTheme = UiTheme.Default,
    diagnostics: MutableList<UiDiagnostic> = ArrayList(),
    vocabulary: Vocabulary = Vocabulary.Default,
): RenderNode {
    fun at(name: String) = mapOf("element" to node.id, "property" to name)

    /** The resolved last `name` property as text, or null. */
    fun resolved(name: String): String? {
        val value = node.prop(name)?.firstOrNull() ?: return null
        return when (val token = theme.resolve(value, diagnostics, at(name))) {
            null -> null
            is TokenValue.Text -> token.text
            is TokenValue.Dimension -> numberText(token.dp.value.toDouble())
            is TokenValue.Number -> numberText(token.value)
            is TokenValue.Duration -> "${token.millis}ms"
            is TokenValue.ColorValue -> value.textOrNull ?: value.toLink().format()
        }
    }

    /** The dp of the dimension property [name], renamed to [renamed]. */
    fun points(name: String, renamed: String = name): Pair<String, String>? {
        val value = node.prop(name)?.firstOrNull() ?: return null
        val dp = when (val token = theme.resolve(value, diagnostics, at(name))) {
            null -> return null
            is TokenValue.Dimension -> token.dp.value.toDouble()
            is TokenValue.Number -> token.value
            else -> {
                diagnostics += UiDiagnostic("unsupported-value", Severity.WARNING, at(name))
                return null
            }
        }
        return renamed to numberText(dp)
    }

    fun text(name: String): String? = resolved(name) ?: node.positional.takeIf { it.isNotEmpty() }
        ?.joinToString(" ") { it.argumentText() }

    return when (node.kind) {
        "document" -> RenderNode(node.id, "Column", listOf("scroll" to "vertical"), kind = node.kind, label = resolved("title"))
        "stack" -> {
            val horizontal = resolved("direction") == "horizontal"
            val props = listOfNotNull(points("gap", "spacing"), points("padding")).toMutableList()
            resolved("align")?.let { align ->
                props += "alignment" to when (align) {
                    "start" -> if (horizontal) "Top" else "Start"
                    "end" -> if (horizontal) "Bottom" else "End"
                    else -> if (horizontal) "CenterVertically" else "CenterHorizontally"
                }
            }
            RenderNode(node.id, if (horizontal) "Row" else "Column", props, kind = node.kind)
        }
        "text" -> {
            val content = text("value").orEmpty()
            RenderNode(node.id, "Text", kind = node.kind, text = content, label = content)
        }
        "button" -> {
            val label = text("label").orEmpty()
            val (handlers, problems) = uiHandlers(node, vocabulary)
            diagnostics += problems
            val props = mutableListOf("label" to label)
            resolved("variant")?.takeIf { it == "outlined" || it == "text" }?.let { props += "variant" to it }
            if (resolved("disabled") == "true") props += "disabled" to "true"
            RenderNode(node.id, "Button", props, kind = node.kind, label = label, handlers = handlers)
        }
        "image" -> {
            val props = ArrayList<Pair<String, String>>()
            text("source")?.let { source ->
                if (valueMatches(UiValue.Atom("url"), UiValue.Atom(source)) && !isUnsafeUrl(source)) {
                    props += "url" to source
                } else {
                    diagnostics += UiDiagnostic("unsafe-url", Severity.ERROR, at("source"))
                }
            }
            props += listOfNotNull(points("width"), points("height"))
            val alt = resolved("alt")
            if (alt != null) props += "alt" to alt
            RenderNode(node.id, "Image", props, kind = node.kind, label = alt)
        }
        else -> {
            diagnostics += UiDiagnostic("unsupported-kind", Severity.WARNING, mapOf("element" to node.id, "kind" to node.kind))
            RenderNode(node.id, "Box", kind = node.kind)
        }
    }
}
