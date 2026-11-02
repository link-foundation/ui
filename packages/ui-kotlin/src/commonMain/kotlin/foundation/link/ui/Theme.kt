package foundation.link.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import foundation.link.ui.tokens.Tokens

/** A resolved design token value. */
sealed class TokenValue {
    /** `16px`, `1rem` or `1em` (= 16 dp), or `0`. */
    data class Dimension(val dp: Dp) : TokenValue()

    /** `'#6750A4'`, `'#6750A4CC'` or `(rgb 103 80 164)`. */
    data class ColorValue(val color: Color) : TokenValue()

    /** `150ms` or `0.2s`, in milliseconds. */
    data class Duration(val millis: Long) : TokenValue()

    /** `0.38`. */
    data class Number(val value: Double) : TokenValue()

    /** Any other atom, such as a font family name. */
    data class Text(val text: String) : TokenValue()
}

/**
 * A theme: design tokens by dotted name (`color.primary`), and whether it is
 * dark. [Default] is the `material3` set of
 * `docs/case-studies/issue-1/samples/tokens.lino`, compiled into `Tokens.kt` by
 * the `@link-foundation/ui-tokens` Kotlin output (#19). [fromLino] reads a
 * theme `.lino` at run time with the official parser (#31).
 */
class UiTheme(
    val id: String,
    val tokens: Map<String, TokenValue>,
    val dark: Boolean = false,
    /** What [fromLino] found wrong; empty for [Default]. */
    val diagnostics: List<UiDiagnostic> = emptyList(),
) {
    /** The token [name], or null. */
    fun token(name: String): TokenValue? = tokens[name]

    /**
     * Resolves a property value: a literal, `(token name)` or `(or a b c)`.
     * A token that does not exist adds the warning `unresolved-token` to
     * [diagnostics] (with [at]) and gives null; it never throws.
     */
    fun resolve(
        value: UiValue,
        diagnostics: MutableList<UiDiagnostic>? = null,
        at: Map<String, Any?> = emptyMap(),
    ): TokenValue? {
        if (value is UiValue.Atom) return parseLiteral(value.text)
        val group = value as UiValue.Group
        val args = group.values.drop(1)
        return when (value.head) {
            "token" -> {
                val name = args.singleOrNull()?.textOrNull
                name?.let { tokens[it] } ?: run {
                    diagnostics?.add(UiDiagnostic("unresolved-token", Severity.WARNING, at + ("token" to name)))
                    null
                }
            }
            "param" -> {
                // Component parameters are bound by components, which v0 does not render.
                diagnostics?.add(UiDiagnostic("unresolved-param", Severity.WARNING, at))
                null
            }
            "or" -> {
                // The first argument that resolves wins; misses are reported
                // only when none resolves.
                val misses = ArrayList<UiDiagnostic>()
                args.firstNotNullOfOrNull { resolve(it, misses, at) }
                    ?: null.also { diagnostics?.addAll(misses) }
            }
            else -> parseColorFunction(group.values)
        }
    }

    /** [resolve] as a dimension, or null. */
    fun dimension(value: UiValue?, diagnostics: MutableList<UiDiagnostic>? = null, at: Map<String, Any?> = emptyMap()): Dp? =
        value?.let { (resolve(it, diagnostics, at) as? TokenValue.Dimension)?.dp }

    /** [resolve] as a colour, or null. */
    fun color(value: UiValue?, diagnostics: MutableList<UiDiagnostic>? = null, at: Map<String, Any?> = emptyMap()): Color? =
        value?.let { (resolve(it, diagnostics, at) as? TokenValue.ColorValue)?.color }

    /** The colour token [name], or null. */
    fun colorToken(name: String): Color? = (tokens[name] as? TokenValue.ColorValue)?.color

    companion object {
        /** The `material3` set of the issue #1 sample, from the generated [Tokens]. */
        val Default: UiTheme = UiTheme(
            id = "material3",
            tokens = linkedMapOf(
                "color.primary" to TokenValue.ColorValue(Tokens.ColorPrimary),
                "color.on-primary" to TokenValue.ColorValue(Tokens.ColorOnPrimary),
                "space.medium" to TokenValue.Dimension(Tokens.SpaceMedium),
                "shape.corner.medium" to TokenValue.Dimension(Tokens.ShapeCornerMedium),
                "motion.duration.short" to TokenValue.Duration(Tokens.MotionDurationShortMs.toLong()),
            ),
        )

        /**
         * Reads the `theme` [setId] of [text] (the first one when null). Its
         * tokens are taken in the order of `docs/spec/values.md`: the set's own
         * tokens, then its `(extends ...)` chain, then [base]. With [mode], the
         * tokens of `(mode NAME (token ...) ...)` in each set replace that set's
         * own; `dark` makes [UiTheme.dark] true. Problems are [diagnostics]
         * (`unknown-set`, `unresolved-token`, `reference-cycle`,
         * `unsupported-value` and those of the document); it never throws.
         */
        fun fromLino(text: String, setId: String? = null, mode: String? = null, base: UiTheme? = Default): UiTheme {
            val document = parseDocument(text)
            // `(mode ...)` is a ui-tokens link, not a ui-dialect/0 property.
            val diagnostics = document.diagnostics
                .filterNot { it.code == "unknown-sublink" && it.at["head"] == "mode" }
                .toMutableList()
            val sets = document.elements.filter { it.kind == "theme" && it.id != null }.associateBy { it.id!! }
            val id = setId ?: sets.keys.firstOrNull()
            val root = id?.let { sets[it] }
            if (root == null) {
                diagnostics += UiDiagnostic("unknown-set", Severity.ERROR, mapOf("element" to id))
                return UiTheme(id ?: base?.id.orEmpty(), base?.tokens.orEmpty(), mode == "dark", diagnostics)
            }
            // The chain, base first: every parent depth first, then the set.
            val chain = ArrayList<UiNode>()
            fun visit(set: UiNode, seen: Set<String>) {
                if (set.id in seen || chain.contains(set)) return
                for (parent in set.properties.filter { it.name == "extends" }.flatMap { it.values }) {
                    val name = parent.textOrNull.orEmpty()
                    val found = sets[name]
                    if (found == null) {
                        diagnostics += UiDiagnostic("unknown-set", Severity.WARNING, mapOf("element" to set.id, "extends" to name))
                    } else {
                        visit(found, seen + set.id!!)
                    }
                }
                chain += set
            }
            visit(root, emptySet())
            val raw = LinkedHashMap<String, UiValue>()
            for (set in chain) {
                for (property in set.properties.filter { it.name == "token" }) addToken(raw, property.values)
                if (mode != null) {
                    set.unknown.filter { it.head == "mode" }
                        .map { (it as UiValue.Group).values }
                        .filter { it.getOrNull(1)?.textOrNull == mode }
                        .forEach { values ->
                            values.drop(2).filter { it.head == "token" }
                                .forEach { addToken(raw, (it as UiValue.Group).values.drop(1)) }
                        }
                }
            }
            val baseTokens = base?.tokens.orEmpty()
            val resolved = LinkedHashMap(baseTokens)
            val baseTheme = UiTheme(base?.id.orEmpty(), baseTokens)
            fun resolveToken(name: String, visiting: Set<String>): TokenValue? {
                val value = raw[name] ?: return baseTokens[name]
                val at = mapOf("element" to root.id, "property" to "token", "token" to name)
                if (name in visiting) {
                    diagnostics += UiDiagnostic("reference-cycle", Severity.ERROR, at)
                    return null
                }
                if (value.head == "token") {
                    val target = (value as UiValue.Group).values.getOrNull(1)?.textOrNull.orEmpty()
                    if (target !in raw && target !in baseTokens) {
                        diagnostics += UiDiagnostic("unresolved-token", Severity.WARNING, at + ("token" to target))
                        return null
                    }
                    return resolveToken(target, visiting + name)
                }
                return baseTheme.resolve(value, diagnostics, at) ?: null.also {
                    if (value.head != "or") diagnostics += UiDiagnostic("unsupported-value", Severity.WARNING, at)
                }
            }
            for (name in raw.keys) {
                val value = resolveToken(name, emptySet())
                if (value != null) resolved[name] = value else resolved.remove(name)
            }
            return UiTheme(root.id!!, resolved, mode == "dark", diagnostics.distinct())
        }

        private fun addToken(raw: MutableMap<String, UiValue>, values: List<UiValue>) {
            val name = values.getOrNull(0)?.textOrNull ?: return
            val value = values.getOrNull(1) ?: return
            raw.remove(name)
            raw[name] = value
        }
    }
}

private val PX = Regex("^(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))(px|rem|em)$")
private val MS = Regex("^((?:\\d+(?:\\.\\d+)?|\\.\\d+))(ms|s)$")
private val PLAIN_NUMBER = Regex("^-?(\\d+(\\.\\d+)?|\\.\\d+)([eE][-+]?\\d+)?$")
private val HEX = Regex("^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

/** A literal atom as a typed value: hex colour, dimension, duration, number or text. */
fun parseLiteral(text: String): TokenValue {
    if (text == "0") return TokenValue.Dimension(0.dp)
    HEX.matchEntire(text)?.let { return TokenValue.ColorValue(hexColor(it.groupValues[1])) }
    PX.matchEntire(text)?.let {
        val number = it.groupValues[1].toFloat()
        return TokenValue.Dimension((if (it.groupValues[2] == "px") number else number * 16).dp)
    }
    MS.matchEntire(text)?.let {
        val number = it.groupValues[1].toDouble()
        return TokenValue.Duration((if (it.groupValues[2] == "s") number * 1000 else number).toLong())
    }
    if (PLAIN_NUMBER.matches(text)) return TokenValue.Number(text.toDouble())
    return TokenValue.Text(text)
}

/** `RGB`, `RGBA`, `RRGGBB` or `RRGGBBAA` as a colour. */
private fun hexColor(digits: String): Color {
    val full = if (digits.length <= 4) digits.map { "$it$it" }.joinToString("") else digits
    val rgb = full.substring(0, 6).toLong(16)
    val alpha = if (full.length == 8) full.substring(6, 8).toLong(16) else 0xFF
    return Color((alpha shl 24) or rgb)
}

/** `(rgb r g b [a])`; other colour functions are not supported yet. */
private fun parseColorFunction(values: List<UiValue>): TokenValue? {
    if (values.firstOrNull()?.textOrNull != "rgb") return null
    val channels = values.drop(1).map { it.textOrNull?.removeSuffix("%")?.toFloatOrNull() ?: return null }
    if (channels.size !in 3..4) return null
    val alpha = channels.getOrNull(3)?.let { if (it > 1f) it / 100f else it } ?: 1f
    return TokenValue.ColorValue(Color(channels[0] / 255f, channels[1] / 255f, channels[2] / 255f, alpha.coerceIn(0f, 1f)))
}
