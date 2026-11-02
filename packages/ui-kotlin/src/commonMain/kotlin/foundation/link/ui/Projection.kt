package foundation.link.ui

import io.github.linkfoundation.linksnotation.Link
import io.github.linkfoundation.linksnotation.ParseException
import io.github.linkfoundation.linksnotation.Parser
import io.github.linkfoundation.linksnotation.ParserOptions

/** The dialect version this renderer reads (`docs/spec/README.md`). */
const val SPEC_VERSION: String = "ui-dialect/0"

/** How deep links may nest (`docs/spec/limits.md`). */
const val MAX_DEPTH: Int = 64

/** The longest document read, in UTF-16 code units (`docs/spec/limits.md`). */
const val MAX_INPUT_SIZE: Int = 1024 * 1024

/**
 * Reads ui-dialect/0 text into a [UiDocument] with the official Links Notation
 * parser, and reports every diagnostic of `docs/spec/`. Never throws on bad
 * input: a document that cannot be read gives a document with no elements and
 * one `syntax-error`, `depth-exceeded` or `input-too-large` diagnostic.
 */
fun parseDocument(text: String, vocabulary: Vocabulary = Vocabulary.Default): UiDocument = project(text, vocabulary)

/**
 * The projection of `docs/spec/projection.md`, ported from the non-normative
 * `scripts/spec-reference-projection.mjs` so that both give the same
 * `.tree.json` for every fixture (checked by `FixtureTest`).
 */
internal fun project(text: String, vocabulary: Vocabulary): UiDocument {
    if (text.length > MAX_INPUT_SIZE) {
        return UiDocument(emptyList(), listOf(UiDiagnostic("input-too-large", Severity.ERROR)))
    }
    val links = try {
        Parser(ParserOptions(maxDepth = MAX_DEPTH, maxInputSize = MAX_INPUT_SIZE)).parse(text)
    } catch (error: ParseException) {
        val code = when (error) {
            is ParseException.DepthExceeded -> "depth-exceeded"
            is ParseException.InputTooLarge -> "input-too-large"
            is ParseException.Syntax -> "syntax-error"
        }
        val at = (error as? ParseException.Syntax)?.takeIf { it.line != 0 }
            ?.let { mapOf("line" to it.line, "column" to it.column) } ?: emptyMap()
        return UiDocument(emptyList(), listOf(UiDiagnostic(code, Severity.ERROR, at)))
    }
    val projector = Projector(vocabulary)
    links.forEach(projector::top)
    val elements = projector.root.children.map { it.freeze() }
    val diagnostics = projector.diagnostics
    if (vocabulary.actions.isNotEmpty()) {
        checkValues(elements, vocabulary, diagnostics)
        checkTokenCycles(elements, diagnostics)
    }
    return UiDocument(elements, diagnostics.toList(), projector.root.unknown.map { it.freeze() })
}

// --- mutable tree, built while folding and frozen into UiNode afterwards ---

private sealed class MValue {
    abstract fun freeze(): UiValue
}

private class MAtom(val text: String) : MValue() {
    override fun freeze() = UiValue.Atom(text)
}

private class MGroup(val id: String?, val values: MutableList<MValue>) : MValue() {
    override fun freeze() = UiValue.Group(id, values.map { it.freeze() })
}

private class MProp(val name: String, val values: MutableList<MValue> = ArrayList())

private class MElement(val id: String?, val kind: String?) {
    val positional = ArrayList<String>()
    val properties = ArrayList<MProp>()
    val children = ArrayList<MElement>()
    val unknown = ArrayList<MValue>()

    fun freeze(): UiNode = UiNode(
        id = id,
        kind = kind,
        positional = positional.map { UiValue.Atom(it) },
        properties = properties.map { p -> UiProp(p.name, p.values.map { it.freeze() }) },
        children = children.map { it.freeze() },
        unknown = unknown.map { it.freeze() },
    )
}

/** A node of the folding context: an element, or a node that collects values. */
private sealed class Target {
    val local = HashMap<String, Target>()
}

private class ElementTarget(val element: MElement) : Target()

private class ValueTarget(
    val values: MutableList<MValue>,
    val owner: MElement,
    val name: String?,
    val unknown: Boolean,
) : Target()

private val Link.isAtom get() = values.isEmpty()

/** A path link: no id, and its first value is a link (projection.md). */
private val Link.isPath get() = !isAtom && id == null && !values[0].isAtom

/** The anonymous wrapper of a multi-line group, `(H (H a) (H b) ...)`. */
private val Link.isGroupWrapper: Boolean
    get() {
        if (!isPath || values.size < 2) return false
        val key = values[0].format()
        return values.drop(1).all { it.isPath && it.values[0].format() == key }
    }

private fun Link.toValue(): MValue =
    if (isAtom) MAtom(id.orEmpty()) else MGroup(id, values.mapTo(ArrayList()) { it.toValue() })

private class Projector(val vocabulary: Vocabulary) {
    val diagnostics = ArrayList<UiDiagnostic>()
    private val ids = HashSet<String>()
    private val global = HashMap<String, Target>()
    val root = MElement(null, null)
    private val rootTarget = ElementTarget(root)

    private fun warn(code: String, at: Map<String, Any?>) {
        diagnostics += UiDiagnostic(code, Severity.WARNING, at)
    }

    private fun error(code: String, at: Map<String, Any?>) {
        diagnostics += UiDiagnostic(code, Severity.ERROR, at)
    }

    /** The root accepts only elements: an atom there is an unknown sublink. */
    fun top(link: Link) {
        if (link.isAtom) {
            warn("unknown-sublink", mapOf("element" to null, "head" to link.id))
            root.unknown += MAtom(link.id.orEmpty())
            return
        }
        append(rootTarget, link)
    }

    private fun makeElement(link: Link, id: String?): ElementTarget {
        val kindLink = link.values.firstOrNull()
        val kind = if (kindLink != null && kindLink.isAtom) kindLink.id else null
        val target = ElementTarget(MElement(id, kind))
        if (id != null) {
            if (id in ids) error("duplicate-id", mapOf("element" to id))
            ids += id
        }
        if (kind == null) {
            error("missing-kind", mapOf("element" to id))
        } else if (kind !in vocabulary.kinds) {
            warn("unknown-kind", mapOf("element" to id, "kind" to kind))
        }
        if (id != null) global[Link(id, link.values.filter { it.isAtom }).format()] = target
        // The head names the element inside itself too, so the path links of
        // a multi-line group fold into it.
        target.local[link.format()] = target
        for (value in link.values.drop(1)) append(target, value)
        return target
    }

    /** Appends one value of the source to an element or value node. */
    private fun append(node: Target, value: Link): Target? {
        if (node is ValueTarget) return appendToValues(node, value)
        node as ElementTarget
        if (value.isPath) return fold(node, value)
        val element = node.element
        if (value.isAtom) {
            checkSigil(value.id.orEmpty(), element.id, null)
            element.positional += value.id.orEmpty()
            return null
        }
        if (value.id != null) return addChild(node, value, value.id)
        val head = value.values[0].id.orEmpty()
        val spec = element.kind?.let { vocabulary.kinds[it] }
        val propertySpec = spec?.properties?.get(head)
        if (propertySpec != null) return addProperty(node, value, head, propertySpec)
        if (head in vocabulary.kinds) return addChild(node, value, null)
        return keepUnknown(node, value, head)
    }

    private fun addChild(node: ElementTarget, value: Link, id: String?): Target {
        val child = makeElement(value, id)
        node.element.children += child.element
        node.local[value.format()] = child
        return child
    }

    /** Keeps an unknown sublink; its indented lines fold into it. */
    private fun keepUnknown(node: ElementTarget, link: Link, head: String): Target {
        warn("unknown-sublink", mapOf("element" to node.element.id, "head" to head))
        val json = link.toValue() as MGroup
        node.element.unknown += json
        val unknown = ValueTarget(json.values, node.element, null, unknown = true)
        unknown.local[link.format()] = unknown
        node.local[link.format()] = unknown
        return unknown
    }

    private fun addProperty(node: ElementTarget, link: Link, name: String, spec: PropertySpec): Target {
        val element = node.element
        val property = MProp(name)
        val target = ValueTarget(property.values, element, name, unknown = false)
        target.local[link.format()] = target
        if (!spec.multi) {
            val index = element.properties.indexOfFirst { it.name == name }
            if (index != -1) {
                warn("duplicate-property", mapOf("element" to element.id, "property" to name))
                element.properties.removeAt(index)
            }
        }
        element.properties += property
        node.local[link.format()] = target
        for (value in link.values.drop(1)) appendToValues(target, value)
        return target
    }

    /** Appends one value to a value node; returns the node of a nested link. */
    private fun appendToValues(property: ValueTarget, value: Link): Target? {
        if (value.isPath) {
            val first = value.values[0]
            val wrapper = value.isGroupWrapper
            val target = if (wrapper) appendToValues(property, first) else property.local[first.format()]
            if (target != null) {
                for (item in value.values.drop(1)) {
                    val created = append(target, item)
                    if (created != null) property.local[Link(null, listOf(first, item)).format()] = created
                }
                return target
            }
        }
        val json = value.toValue()
        if (!property.unknown) walkSigils(json, property.owner.id, property.name)
        property.values += json
        if (json !is MGroup) return null
        val node = ValueTarget(json.values, property.owner, property.name, property.unknown)
        property.local[value.format()] = node
        node.local[value.format()] = node
        return node
    }

    /** Whether an unknown path may be declared in an element (projection.md). */
    private fun declarable(context: ElementTarget, path: Link): Boolean {
        if (path.id != null) return true
        if (path.isPath) {
            val key = path.values[0].format()
            return key in context.local || key in global || declarable(context, path.values[0])
        }
        val head = path.values[0].id.orEmpty()
        return head in vocabulary.kinds || context.element.kind?.let { vocabulary.kinds[it] }?.properties?.containsKey(head) == true
    }

    /** Path folding: `(P v1 v2 ...)` where P is a head or a known path. */
    private fun fold(context: ElementTarget, link: Link): Target? {
        val first = link.values[0]
        val key = first.format()
        val wrapper = link.isGroupWrapper
        var target = if (wrapper) null else context.local[key] ?: global[key]
        if (target == null) {
            if (!wrapper && !declarable(context, first)) {
                warn("unknown-sublink", mapOf("element" to context.element.id, "head" to null))
                context.element.unknown += link.toValue()
                return null
            }
            target = append(context, first) ?: return null
        }
        for (value in link.values.drop(1)) {
            val created = append(target, value)
            if (created != null) global[Link(null, listOf(first, value)).format()] = created
        }
        return target
    }

    private fun checkSigil(text: String, element: String?, property: String?) {
        if (text.startsWith("@") || text.startsWith("$")) {
            warn(
                "reserved-sigil",
                if (property != null) mapOf("element" to element, "property" to property) else mapOf("element" to element),
            )
        }
    }

    private fun walkSigils(value: MValue, element: String?, property: String?) {
        when (value) {
            is MAtom -> checkSigil(value.text, element, property)
            is MGroup -> value.values.forEach { walkSigils(it, element, property) }
        }
    }
}

// --- value checks that need the vocabulary types (values.md, behaviour.md) ---

private val DIMENSION = Regex("^-?(\\d+(\\.\\d+)?|\\.\\d+)(px|rem|em|%|vw|vh)$")
private val NUMBER = Regex("^-?(\\d+(\\.\\d+)?|\\.\\d+)([eE][-+]?\\d+)?$")
private val DURATION = Regex("^(\\d+(\\.\\d+)?|\\.\\d+)(ms|s)$")
private val HEX_COLOR = Regex("^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
private val TOKEN_NAME = Regex("^[a-z0-9-]+(\\.[a-z0-9-]+)*$")
private val URL = Regex("^(https?:|mailto:|/|\\.)")

/** `javascript:`, `data:` and `vbscript:` targets are never followed (behaviour.md). */
val UNSAFE_URL: Regex = Regex("^\\s*(javascript|data|vbscript):", RegexOption.IGNORE_CASE)

/** Whether a navigate target is one a renderer must refuse. */
fun isUnsafeUrl(target: String): Boolean = UNSAFE_URL.containsMatchIn(target)

private val UiValue.anonymous: List<UiValue>? get() = (this as? UiValue.Group)?.takeIf { it.id == null }?.values

private fun stringMatches(type: String, value: String): Boolean = when (type) {
    "number" -> NUMBER.matches(value)
    "dimension" -> DIMENSION.matches(value) || value == "0"
    "duration" -> DURATION.matches(value)
    "color" -> HEX_COLOR.matches(value)
    "url" -> URL.containsMatchIn(value) || ':' !in value
    "token-name" -> TOKEN_NAME.matches(value)
    else -> true
}

private fun isFunctionalColor(values: List<UiValue>): Boolean {
    val space = values.firstOrNull()?.textOrNull
    val channels = values.drop(1)
    return space in setOf("oklch", "rgb") && channels.size in 3..4 &&
        channels.all { c -> c.textOrNull?.let { NUMBER.matches(it.removeSuffix("%")) } == true }
}

/** Whether [value] fits the vocabulary [type] (an atom or `(enum ...)`). */
internal fun valueMatches(type: UiValue, value: UiValue): Boolean {
    val text = value.textOrNull
    if (text != null && (text.startsWith("@") || text.startsWith("$"))) return true
    val list = value.anonymous
    if (list != null && list.firstOrNull()?.textOrNull in setOf("token", "param", "or")) {
        return if (list[0].textOrNull == "or") {
            list.drop(1).all { valueMatches(type, it) }
        } else {
            list.size == 2 && list[1] is UiValue.Atom
        }
    }
    val enumValues = type.anonymous
    if (enumValues != null) return enumValues.firstOrNull()?.textOrNull == "enum" && text != null && value in enumValues.drop(1)
    val typeName = type.textOrNull.orEmpty()
    if (text == null) {
        if (typeName == "color" && list != null) return isFunctionalColor(list)
        return typeName == "any" || typeName == "action"
    }
    return stringMatches(typeName, text)
}

private fun checkValues(elements: List<UiNode>, vocabulary: Vocabulary, diagnostics: MutableList<UiDiagnostic>) {
    fun visit(element: UiNode) {
        val spec = element.kind?.let { vocabulary.kinds[it] }
        for (property in element.properties) {
            val type = spec?.properties?.get(property.name)?.type
            val name = type?.textOrNull
            val at = mapOf("element" to element.id, "property" to property.name)
            when {
                name == "action" -> checkHandler(property.values, vocabulary, diagnostics, at)
                type == null || name == "any" || name == "string" -> Unit
                else -> property.values.filterNot { valueMatches(type, it) }
                    .forEach { _ -> diagnostics += UiDiagnostic("invalid-value", Severity.ERROR, at) }
            }
        }
        if (spec != null && spec.children == "none" && element.children.isNotEmpty()) {
            diagnostics += UiDiagnostic("unexpected-child", Severity.WARNING, mapOf("element" to element.id))
        }
        element.children.forEach(::visit)
    }
    elements.forEach(::visit)
}

/** `(on <event> <action>...)`: actions are data, never code. */
internal fun checkHandler(
    values: List<UiValue>,
    vocabulary: Vocabulary,
    diagnostics: MutableList<UiDiagnostic>,
    at: Map<String, Any?>,
) {
    val event = values.firstOrNull()
    val actions = values.drop(1)
    if (event !is UiValue.Atom || actions.isEmpty()) {
        diagnostics += UiDiagnostic("invalid-handler", Severity.ERROR, at)
        return
    }
    for (action in actions) {
        val list = action.anonymous
        if (list == null) {
            diagnostics += UiDiagnostic("invalid-handler", Severity.ERROR, at)
            continue
        }
        val name = list.firstOrNull()?.textOrNull
        if (name == null || name !in vocabulary.actions) {
            diagnostics += UiDiagnostic("unknown-action", Severity.WARNING, at)
            continue
        }
        if (name == "navigate" && isUnsafeUrl(list.getOrNull(1)?.let(::valueText).orEmpty())) {
            diagnostics += UiDiagnostic("unsafe-url", Severity.ERROR, at)
        }
    }
}

/** `String(value)` of the reference: an atom is its text, a list joins with commas. */
internal fun valueText(value: UiValue): String = when (value) {
    is UiValue.Atom -> value.text
    is UiValue.Group -> if (value.id == null) value.values.joinToString(",") { valueText(it) } else "[object Object]"
}

/** `reference-cycle`: token values that refer to each other along a theme chain. */
private fun checkTokenCycles(elements: List<UiNode>, diagnostics: MutableList<UiDiagnostic>) {
    class ThemeTokens(val tokens: Map<String, UiValue?>, val base: String?)
    val themes = LinkedHashMap<String?, ThemeTokens>()
    for (element in elements.filter { it.kind == "theme" }) {
        val tokens = LinkedHashMap<String, UiValue?>()
        var base: String? = null
        for (property in element.properties) {
            if (property.name == "token") tokens[property.values.firstOrNull()?.let(::valueText).orEmpty()] = property.values.getOrNull(1)
            if (property.name == "extends") base = property.values.firstOrNull()?.let(::valueText)
        }
        themes[element.id] = ThemeTokens(tokens, base)
    }
    fun lookup(theme: String?, name: String): UiValue? {
        val seen = HashSet<String?>()
        var t = theme
        while (t != null && t in themes && t !in seen) {
            seen += t
            val entry = themes.getValue(t)
            if (name in entry.tokens) return entry.tokens[name]
            t = entry.base
        }
        return null
    }
    fun refs(value: UiValue?): List<String> {
        val list = value?.anonymous ?: return emptyList()
        return if (list.firstOrNull()?.textOrNull == "token") {
            listOfNotNull(list.getOrNull(1)?.let(::valueText))
        } else {
            list.flatMap(::refs)
        }
    }
    for ((theme, entry) in themes) {
        for (name in entry.tokens.keys) {
            val visiting = HashSet<String>()
            var cycle = false
            fun walk(n: String) {
                if (n in visiting) {
                    cycle = n == name || cycle
                    return
                }
                visiting += n
                refs(lookup(theme, n)).forEach(::walk)
                visiting -= n
            }
            walk(name)
            if (cycle) {
                diagnostics += UiDiagnostic(
                    "reference-cycle",
                    Severity.ERROR,
                    mapOf("element" to theme, "property" to "token", "token" to name),
                )
            }
        }
    }
}
