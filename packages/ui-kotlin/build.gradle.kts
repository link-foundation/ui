import java.time.Duration
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// ui-kotlin: renders ui-dialect/0 documents with Jetpack Compose / Compose
// Multiplatform Material 3 components (issue #32). Every dependency is
// Apache-2.0; see README.md, "Dependencies and licences".

plugins {
    kotlin("multiplatform") version "2.4.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21"
    id("org.jetbrains.compose") version "1.12.2"
    id("com.android.kotlin.multiplatform.library") version "9.5.0" apply false
}

group = "foundation.link.ui"
version = "0.1.0"

val composeVersion = "1.12.2"
val material3Version = "1.9.0"

// Android needs an SDK. CI has one; elsewhere the Android target is left out
// rather than failing the build of the desktop target (the same rule as the
// parser in native/kotlin/links-notation).
val androidSdk: String? =
    System.getenv("ANDROID_HOME")?.takeIf { it.isNotBlank() }
        ?: System.getenv("ANDROID_SDK_ROOT")?.takeIf { it.isNotBlank() }
        ?: file("local.properties").takeIf { it.isFile }?.readLines()
            ?.firstOrNull { it.startsWith("sdk.dir=") }?.substringAfter("=")
val withAndroid = androidSdk != null && file(androidSdk).isDirectory

if (withAndroid) {
    apply(plugin = "com.android.kotlin.multiplatform.library")
}

// docs/spec/vocabulary.lino is the one source of the kinds, properties and
// actions; it is compiled in as a string so that the renderer works without
// reading files at run time (Android, a packaged desktop app).
val generateVocabulary = tasks.register("generateVocabulary") {
    val source = layout.projectDirectory.file("../../docs/spec/vocabulary.lino")
    val output = layout.buildDirectory.dir("generated/vocabulary/commonMain/kotlin")
    inputs.file(source)
    outputs.dir(output)
    doLast {
        // One ordinary string literal per line: backslashes, quotes and
        // dollar signs are escaped, so any text compiles as itself.
        val lines = source.asFile.readText().split("\n").joinToString(" +\n") { line ->
            val escaped = line.replace("\\", "\\\\").replace("\"", "\\\"").replace("$", "\\$")
            "    \"" + escaped + "\\n\""
        }
        val file = output.get().file("foundation/link/ui/VocabularyText.kt").asFile
        file.parentFile.mkdirs()
        file.writeText(
            "// Generated from docs/spec/vocabulary.lino by the generateVocabulary task. Do not edit.\n" +
                "package foundation.link.ui\n\n" +
                "internal val VOCABULARY_LINO: String =\n" + lines + "\n",
        )
    }
}

kotlin {
    jvm("desktop") {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    if (withAndroid) {
        extensions.configure<com.android.build.api.dsl.KotlinMultiplatformAndroidLibraryTarget>("android") {
            namespace = "foundation.link.ui"
            compileSdk = 36
            minSdk = 23
        }
    }

    sourceSets {
        commonMain {
            kotlin.srcDir(generateVocabulary)
            dependencies {
                implementation("io.github.link-foundation:links-notation-kotlin:0.1.0")
                api("org.jetbrains.compose.runtime:runtime:$composeVersion")
                api("org.jetbrains.compose.foundation:foundation:$composeVersion")
                api("org.jetbrains.compose.ui:ui:$composeVersion")
                api("org.jetbrains.compose.material3:material3:$material3Version")
            }
        }
        commonTest {
            dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.compose.ui:ui-test:$composeVersion")
            }
        }
        getByName("desktopTest") {
            dependencies {
                implementation(compose.desktop.currentOs)
                // Reads the fixtures' .tree.json and .diagnostics.json (test only).
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
            }
        }
    }
}

tasks.withType<Test>().configureEach {
    // A hung Compose test fails the build instead of the CI job timeout.
    timeout.set(Duration.ofMinutes(10))
    // The fixture and snapshot tests read docs/spec/fixtures and
    // src/commonTest/resources/snapshots relative to this directory.
    workingDir = projectDir
    systemProperty("ui.kotlin.updateSnapshots", System.getenv("UPDATE_SNAPSHOTS") ?: "")
    // Compose UI tests render off screen; no display is needed.
    systemProperty("java.awt.headless", "true")
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
