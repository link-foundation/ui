package foundation.link.ui

import io.github.linkfoundation.linksnotation.Link

/*
 * Behaviour (docs/spec/behaviour.md): `(on <event> <action>...)` is data. The
 * renderer never evaluates a string; it hands each checked action to the host
 * as a UiAction. A handler that is not an action list, an unknown action and a
 * `navigate` to a `javascript:`, `data:` or `vbscript:` target are dropped
 * with a diagnostic.
 */

/** One checked `(on <event> <action>...)` of an element. */
data class UiHandler(
    val event: String,
    /** Each action as its head and arguments: `["navigate", "home"]`. */
    val actions: List<List<String>>,
)

/** A value as a Links Notation link. */
fun UiValue.toLink(): Link = when (this) {
    is UiValue.Atom -> Link(text)
    is UiValue.Group -> Link(id, values.map { it.toLink() })
}

/** An action argument as text: an atom is its text, a nested link its Links Notation. */
internal fun UiValue.argumentText(): String = textOrNull ?: toLink().format()

/** The handlers of [node], and the diagnostics of the ones dropped. */
fun uiHandlers(node: UiNode, vocabulary: Vocabulary = Vocabulary.Default): Pair<List<UiHandler>, List<UiDiagnostic>> {
    val handlers = ArrayList<UiHandler>()
    val diagnostics = ArrayList<UiDiagnostic>()
    val at = mapOf("element" to node.id, "property" to "on")
    for (property in node.properties.filter { it.name == "on" }) {
        val event = property.values.firstOrNull()?.textOrNull
        if (event == null || property.values.size < 2) {
            checkHandler(property.values, vocabulary, diagnostics, at)
            continue
        }
        val actions = ArrayList<List<String>>()
        for (action in property.values.drop(1)) {
            val problems = ArrayList<UiDiagnostic>()
            checkHandler(listOf(UiValue.Atom(event), action), vocabulary, problems, at)
            if (problems.isNotEmpty()) {
                diagnostics += problems
                continue
            }
            actions.add((action as UiValue.Group).values.map { it.argumentText() })
        }
        if (actions.isNotEmpty()) handlers += UiHandler(event, actions)
    }
    return handlers to diagnostics
}

/** The actions an [event] of the element [source] runs, in order. */
fun List<UiHandler>.actions(event: String, source: String?): List<UiAction> =
    filter { it.event == event }.flatMap { handler -> handler.actions.map { UiAction(source.orEmpty(), event, it) } }
