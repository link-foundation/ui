package foundation.link.ui

import io.github.linkfoundation.linksnotation.Parser
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/*
 * Render-tree snapshots of the spec fixtures. Every fixture of
 * docs/spec/fixtures (except errors/) whose elements all have a rendered kind
 * has src/commonTest/resources/snapshots/<area>/<name>.render.lino; a new
 * fixture without one, or a snapshot without its fixture, fails. Run
 * `UPDATE_SNAPSHOTS=1 ./gradlew desktopTest` to write the snapshots.
 */
class FixtureTest {
    private val updating = System.getProperty("ui.kotlin.updateSnapshots") == "1"

    @Test
    fun everyRenderableFixtureHasItsSnapshot() {
        val fixtures = renderableFixtures()
        assertTrue(fixtures.size > 20, "too few fixtures use only rendered kinds: ${fixtures.size}")
        val failures = ArrayList<String>()
        for ((fixture, document) in fixtures) {
            val dump = dumpLino(renderTree(document))
            val file = fixture.snapshot()
            if (updating) {
                file.parentFile.mkdirs()
                file.writeText(dump)
                continue
            }
            if (!file.isFile) {
                failures += "${fixture.label} has no snapshot; run UPDATE_SNAPSHOTS=1 ./gradlew desktopTest"
            } else if (file.readText() != dump) {
                failures += "${fixture.label} differs from its snapshot:\n$dump"
            }
        }
        if (failures.isNotEmpty()) fail(failures.joinToString("\n"))
    }

    @Test
    fun aFixtureWithoutASnapshotFails() {
        val empty = Files.createTempDirectory("ui-kotlin-snapshots").toFile()
        try {
            val fixtures = renderableFixtures().map { it.first }
            assertEquals(fixtures, missingSnapshots(fixtures, empty))
            assertEquals(emptyList(), missingSnapshots(fixtures))
        } finally {
            empty.deleteRecursively()
        }
    }

    @Test
    fun noSnapshotWithoutItsFixture() {
        val expected = renderableFixtures().map { it.first.snapshot().canonicalPath }.toSet()
        val stale = snapshotsDirectory.walk().filter { it.isFile && it.name.endsWith(".lino") }
            .map { it.canonicalPath }.filter { it !in expected }.toList()
        assertEquals(emptyList(), stale, "stale snapshots")
    }

    /** The render tree keeps the element ids and the parent/child pairs of the fixture's tree JSON. */
    @Test
    fun renderTreeKeepsTheIdsAndPairsOfTheTreeJson() {
        for ((fixture, document) in renderableFixtures()) {
            val expected = ArrayList<String>()
            fun visit(element: JsonObject, parent: String) {
                val id = (element["id"] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: "-"
                expected += "$parent > $id"
                element["children"]?.jsonArray?.forEach { visit(it.jsonObject, id) }
            }
            readJson(fixture.tree).jsonObject["elements"]!!.jsonArray.forEach { visit(it.jsonObject, "-") }
            val actual = ArrayList<String>()
            fun walk(node: RenderNode, parent: String) {
                val id = node.id ?: "-"
                actual += "$parent > $id"
                node.children.forEach { walk(it, id) }
            }
            renderTree(document).roots.forEach { walk(it, "-") }
            assertEquals(expected, actual, fixture.label)
        }
    }

    /** Every snapshot is Links Notation the official parser reads back. */
    @Test
    fun snapshotsParse() {
        for ((fixture, _) in renderableFixtures()) {
            val file = fixture.snapshot()
            if (!file.isFile) continue
            Parser().parse(file.readText())
            val syntax = parseDocument(file.readText()).diagnostics.filter { it.code.startsWith("syntax") }
            assertEquals(emptyList(), syntax, fixture.label)
        }
    }

    /** The Kotlin projection gives the element tree JSON of every fixture. */
    @Test
    fun projectionEqualsTheTreeJson() {
        val trees = allFixtures().filter { it.tree.isFile }
        assertTrue(trees.size > 40, "too few tree fixtures: ${trees.size}")
        for (fixture in trees) {
            assertEquals(readJson(fixture.tree), parseDocument(fixture.lino.readText()).toJson(), fixture.label)
        }
    }

    /** The Kotlin projection reports the diagnostics of every errors/ fixture. */
    @Test
    fun projectionReportsTheErrorDiagnostics() {
        val errors = allFixtures().filter { it.diagnostics.isFile }
        assertTrue(errors.isNotEmpty())
        for (fixture in errors) {
            val expected = readJson(fixture.diagnostics).jsonObject["diagnostics"] as JsonArray
            val actual = JsonArray(parseDocument(fixture.lino.readText()).diagnostics.map { it.toJson() })
            assertEquals(expected, actual, fixture.label)
        }
    }

    @Test
    fun renderableFixturesCoverEveryRenderedKind() {
        val kinds = renderableFixtures().flatMap { (_, document) -> renderTree(document).allNodes.mapNotNull { it.kind } }.toSet()
        assertEquals(RENDERED_KINDS, kinds)
        assertTrue(File(fixturesDirectory, "samples/document.lino").isFile)
    }
}
