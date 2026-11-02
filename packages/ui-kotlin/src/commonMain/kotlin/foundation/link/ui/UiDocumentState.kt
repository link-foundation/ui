package foundation.link.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember

/**
 * One element of a [UiDocumentState]: its own state, and the slots of its
 * children. The children are fixed; the element's properties can change.
 */
@Stable
class UiElementSlot internal constructor(node: UiNode) {
    internal val state: MutableState<UiNode> = mutableStateOf(node.copy(children = emptyList()))

    /** The slots of the children, in source order. */
    val children: List<UiElementSlot> = node.children.map(::UiElementSlot)

    /** The element as it is now, without its children. */
    val node: UiNode get() = state.value

    /** The element and its children as they are now. */
    fun snapshot(): UiNode = state.value.copy(children = children.map { it.snapshot() })
}

/**
 * A document for [UiView]. It keeps one `mutableStateOf` per element, so
 * [setProp] recomposes only the element it changes, not its parent or its
 * siblings.
 */
@Stable
class UiDocumentState(document: UiDocument) {
    /** The diagnostics of the projection. */
    val projectionDiagnostics: List<UiDiagnostic> = document.diagnostics

    /** The slots of the top-level elements. */
    val roots: List<UiElementSlot> = document.elements.map(::UiElementSlot)

    private val byId: Map<String, UiElementSlot> = buildMap {
        fun visit(slot: UiElementSlot) {
            slot.node.id?.let { if (it !in this) put(it, slot) }
            slot.children.forEach(::visit)
        }
        roots.forEach(::visit)
    }

    /** Reads ui-dialect/0 text with the official parser. */
    constructor(text: String) : this(parseDocument(text))

    /** The element [id] as it is now, without its children, or null. */
    operator fun get(id: String): UiNode? = byId[id]?.node

    /**
     * Sets the property [name] of the element [id] to [values]. Returns false
     * when no element has that id.
     */
    fun setProp(id: String, name: String, values: List<UiValue>): Boolean {
        val slot = byId[id] ?: return false
        slot.state.value = slot.state.value.withProp(name, values)
        return true
    }

    /** [setProp] with atoms: `setProp("greeting", "value", "Hi")`. */
    fun setProp(id: String, name: String, vararg atoms: String): Boolean =
        setProp(id, name, atoms.map { UiValue.Atom(it) })

    /** The document as it is now. */
    fun snapshot(): UiDocument = UiDocument(roots.map { it.snapshot() }, projectionDiagnostics)
}

/** A [UiDocumentState] of [text], kept across recompositions while [text] is the same. */
@Composable
fun rememberUiDocumentState(text: String): UiDocumentState = remember(text) { UiDocumentState(text) }
