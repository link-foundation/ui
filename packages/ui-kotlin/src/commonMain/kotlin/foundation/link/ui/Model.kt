package foundation.link.ui

/**
 * A value of the element tree, in the JSON form of `docs/spec/values.md`:
 * an atom is a string, a nested link without an id is an array of values, and
 * a nested link with an id is `{ "id": ..., "values": [...] }`.
 */
sealed class UiValue {
    /** A reference atom such as `OK`, `16px` or `#6750A4`. */
    data class Atom(val text: String) : UiValue()

    /** A nested link: [id] is null for an anonymous link such as `(navigate home)`. */
    data class Group(val id: String?, val values: List<UiValue>) : UiValue()

    /** The text of an atom, null for a group. */
    val textOrNull: String? get() = (this as? Atom)?.text

    /** The head of a group such as `token` in `(token space.medium)`, null otherwise. */
    val head: String? get() = ((this as? Group)?.values?.firstOrNull() as? Atom)?.text
}

/** A property of an element, `(name values...)`, as in the `.tree.json` files. */
data class UiProp(val name: String, val values: List<UiValue>)

/**
 * An element of the ui-dialect/0 element tree. The fields follow the
 * `.tree.json` shape of `docs/spec/element-tree.schema.json`.
 */
data class UiNode(
    val id: String?,
    val kind: String?,
    val positional: List<UiValue> = emptyList(),
    val properties: List<UiProp> = emptyList(),
    val children: List<UiNode> = emptyList(),
    val unknown: List<UiValue> = emptyList(),
) {
    /** The values of the last property called [name], or null. */
    fun prop(name: String): List<UiValue>? = properties.lastOrNull { it.name == name }?.values

    /** The first value of the property [name] as text, or null. */
    fun propText(name: String): String? = prop(name)?.firstOrNull()?.textOrNull

    /** This element with the property [name] set to [values]: replaced in place, or appended. */
    fun withProp(name: String, values: List<UiValue>): UiNode {
        val index = properties.indexOfLast { it.name == name }
        val next = properties.toMutableList()
        if (index == -1) next.add(UiProp(name, values)) else next[index] = UiProp(name, values)
        return copy(properties = next)
    }
}

/** A projected document: its top-level elements and every diagnostic found. */
data class UiDocument(
    val elements: List<UiNode>,
    val diagnostics: List<UiDiagnostic> = emptyList(),
    val unknown: List<UiValue> = emptyList(),
)

/**
 * An action dispatched by a control: `(ok: button (on press (navigate home)))`
 * pressed gives `UiAction("ok", "press", listOf("navigate", "home"))`.
 * The action is data, a name and its arguments; it is never executed as code.
 */
data class UiAction(val source: String, val event: String, val action: List<String>)

/** How bad a diagnostic is (`docs/spec/limits.md`). */
enum class Severity(val code: String) {
    ERROR("error"),
    WARNING("warning"),
    INFO("info"),
}

/**
 * A diagnostic `{ code, severity, at }` of `docs/spec/limits.md`. [at] holds the
 * fields that apply: `element`, `property`, `head`, `kind`, `token`, `line`,
 * `column`. A value of null is written as JSON `null` (an anonymous element).
 */
data class UiDiagnostic(
    val code: String,
    val severity: Severity,
    val at: Map<String, Any?> = emptyMap(),
)
