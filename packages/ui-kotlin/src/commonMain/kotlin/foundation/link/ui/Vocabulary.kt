package foundation.link.ui

/** A property declared for a kind: `(property gap dimension)`. [type] is an atom or `(enum ...)`. */
data class PropertySpec(val type: UiValue, val multi: Boolean = false)

/** A kind of `docs/spec/vocabulary.lino`: its positional names, properties and children rule. */
data class KindSpec(
    val positional: List<UiValue> = emptyList(),
    val properties: Map<String, PropertySpec> = emptyMap(),
    val children: String = "any",
)

/**
 * The kinds and actions of the dialect. [Vocabulary.Default] is
 * `docs/spec/vocabulary.lino`, compiled into the library by the
 * `generateVocabulary` Gradle task, so it never drifts from the specification.
 */
data class Vocabulary(
    val kinds: Map<String, KindSpec>,
    val actions: Map<String, List<List<UiValue>>>,
) {
    companion object {
        /** `docs/spec/vocabulary.lino`, read once. */
        val Default: Vocabulary by lazy { read(VOCABULARY_LINO) }

        /**
         * Reads a vocabulary document. It is itself a ui-dialect/0 document whose
         * elements have the kind `kind`, `action` or `dialect`, so it is projected
         * with a bootstrap vocabulary, as `scripts/spec-reference-projection.mjs` does.
         */
        fun read(text: String): Vocabulary {
            val document = project(text, BOOTSTRAP)
            require(document.diagnostics.isEmpty()) { "vocabulary: ${document.diagnostics}" }
            fun entries(element: UiNode, name: String): List<Pair<String, PropertySpec>> =
                element.properties.filter { it.name == name }.map { property ->
                    val values = property.values
                    val flags = values.drop(2).mapNotNull { it.textOrNull }
                    values[0].textOrNull.orEmpty() to PropertySpec(values[1], "multi" in flags)
                }
            val common = document.elements.filter { it.kind == "dialect" }.flatMap { entries(it, "common-property") }
            val kinds = LinkedHashMap<String, KindSpec>()
            val actions = LinkedHashMap<String, List<List<UiValue>>>()
            for (element in document.elements) {
                val id = element.id ?: continue
                when (element.kind) {
                    "kind" -> kinds[id] = KindSpec(
                        positional = element.properties.filter { it.name == "positional" }.flatMap { it.values },
                        properties = LinkedHashMap((common + entries(element, "property")).toMap()),
                        children = element.properties.firstOrNull { it.name == "children" }
                            ?.values?.firstOrNull()?.textOrNull ?: "any",
                    )
                    "action" -> actions[id] = element.properties.filter { it.name == "argument" }.map { it.values }
                }
            }
            return Vocabulary(kinds, actions)
        }

        private fun spec(vararg properties: Pair<String, Boolean>) = KindSpec(
            properties = properties.associate { (name, multi) ->
                name to PropertySpec(UiValue.Atom(if (name == "description" || name == "version") "string" else "any"), multi)
            },
        )

        private val BOOTSTRAP = Vocabulary(
            kinds = mapOf(
                "kind" to spec("description" to false, "positional" to false, "property" to true, "children" to false),
                "action" to spec("description" to false, "argument" to true),
                "dialect" to spec(
                    "version" to false,
                    "multi-valued" to false,
                    "reserved-sigil" to false,
                    "reserved-property" to true,
                    "common-property" to true,
                ),
            ),
            actions = emptyMap(),
        )
    }
}
