package foundation.link.ui

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File

/** The repository root; the tests run in packages/ui-kotlin. */
val repositoryRoot: File = File("../..").canonicalFile

/** docs/spec/fixtures, the shared conformance fixtures. */
val fixturesDirectory: File = File(repositoryRoot, "docs/spec/fixtures")

/** Where the render-tree snapshots are kept. */
val snapshotsDirectory: File = File("src/commonTest/resources/snapshots").canonicalFile

/** One fixture `<area>/<name>.lino` and the files next to it. */
data class Fixture(val area: String, val name: String) {
    val lino: File get() = File(fixturesDirectory, "$area/$name.lino")
    val tree: File get() = File(fixturesDirectory, "$area/$name.tree.json")
    val diagnostics: File get() = File(fixturesDirectory, "$area/$name.diagnostics.json")
    fun snapshot(directory: File = snapshotsDirectory): File = File(directory, "$area/$name.render.lino")
    val label: String get() = "$area/$name"
}

/** Every fixture, sorted by area and name. */
fun allFixtures(): List<Fixture> =
    fixturesDirectory.listFiles().orEmpty().filter { it.isDirectory }.sortedBy { it.name }.flatMap { area ->
        area.listFiles().orEmpty().filter { it.name.endsWith(".lino") }.sortedBy { it.name }
            .map { Fixture(area.name, it.name.removeSuffix(".lino")) }
    }

/** True when [node] and all its descendants have a kind the renderer draws. */
fun isRendered(node: UiNode): Boolean = node.kind in RENDERED_KINDS && node.children.all(::isRendered)

/** The fixtures outside errors/ whose every element is drawn, with their projection. */
fun renderableFixtures(): List<Pair<Fixture, UiDocument>> =
    allFixtures().filter { it.area != "errors" }.mapNotNull { fixture ->
        val document = parseDocument(fixture.lino.readText())
        if (document.elements.isNotEmpty() && document.elements.all(::isRendered)) fixture to document else null
    }

/** The fixtures of [fixtures] whose snapshot is not in [directory]. */
fun missingSnapshots(fixtures: List<Fixture>, directory: File = snapshotsDirectory): List<Fixture> =
    fixtures.filterNot { it.snapshot(directory).isFile }

fun readJson(file: File): JsonElement = Json.parseToJsonElement(file.readText())

/** A value as the element tree JSON writes it. */
fun UiValue.toJson(): JsonElement = when (this) {
    is UiValue.Atom -> JsonPrimitive(text)
    is UiValue.Group -> {
        val values = JsonArray(values.map { it.toJson() })
        if (id == null) values else JsonObject(mapOf("id" to JsonPrimitive(id), "values" to values))
    }
}

private fun Any?.toJson(): JsonElement = when (this) {
    null -> JsonNull
    is Number -> JsonPrimitive(this)
    else -> JsonPrimitive(toString())
}

fun UiNode.toJson(): JsonElement = JsonObject(
    mapOf(
        "id" to (id?.let(::JsonPrimitive) ?: JsonNull),
        "kind" to (kind?.let(::JsonPrimitive) ?: JsonNull),
        "positional" to JsonArray(positional.map { it.toJson() }),
        "properties" to JsonArray(
            properties.map { JsonObject(mapOf("name" to JsonPrimitive(it.name), "values" to JsonArray(it.values.map { v -> v.toJson() }))) },
        ),
        "children" to JsonArray(children.map { it.toJson() }),
        "unknown" to JsonArray(unknown.map { it.toJson() }),
    ),
)

fun UiDiagnostic.toJson(): JsonElement = JsonObject(
    mapOf(
        "code" to JsonPrimitive(code),
        "severity" to JsonPrimitive(severity.code),
        "at" to JsonObject(at.mapValues { (_, value) -> value.toJson() }),
    ),
)

fun UiDocument.toJson(): JsonElement = JsonObject(
    mapOf(
        "spec" to JsonPrimitive(SPEC_VERSION),
        "elements" to JsonArray(elements.map { it.toJson() }),
        "diagnostics" to JsonArray(diagnostics.map { it.toJson() }),
    ),
)
