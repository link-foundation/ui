import java.time.Duration
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// ui-kotlin: renders ui-dialect/0 documents with Jetpack Compose / Compose
// Multiplatform Material 3 components (issue #32).

plugins {
    kotlin("multiplatform") version "2.4.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21"
    id("org.jetbrains.compose") version "1.12.2"
    id("com.android.kotlin.multiplatform.library") version "9.5.0" apply false
    id("com.vanniktech.maven.publish") version "0.37.0"
}

group = "io.github.link-foundation.kotlin"
version = "0.1.0"

val composeVersion = "1.12.2"
val material3Version = "1.9.0"
val androidCompileSdk = 37 // Compose 1.12 AARs require API 37 (checkAarMetadata).

// Android needs an SDK. CI has one; elsewhere the Android target is left out
// rather than failing the build of the desktop target (the same rule as the
// parser in native/kotlin/links-notation).
val androidSdk: String? =
    System.getenv("ANDROID_HOME")?.takeIf { it.isNotBlank() }
        ?: System.getenv("ANDROID_SDK_ROOT")?.takeIf { it.isNotBlank() }
        ?: file("local.properties").takeIf { it.isFile }?.readLines()
            ?.firstOrNull { it.startsWith("sdk.dir=") }?.substringAfter("=")
val withAndroid = androidSdk != null && file(androidSdk).isDirectory

// The public release must contain the Android variant as well as desktop.
if (providers.gradleProperty("uiKotlinRequireAndroid").isPresent) {
    check(withAndroid && file("$androidSdk/platforms/android-$androidCompileSdk/android.jar").isFile) {
        "Install Android SDK Platform $androidCompileSdk for the full ui-kotlin publication."
    }
}

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
            compileSdk = androidCompileSdk
            minSdk = 23
        }
    }

    sourceSets {
        commonMain {
            kotlin.srcDir(generateVocabulary)
            dependencies {
                // Public helpers such as UiValue.toLink() expose the parser's Link type.
                api("io.github.link-foundation.kotlin:links-notation:0.31.8")
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

mavenPublishing {
    // Upload to the Portal for validation. The maintainer publishes the
    // validated deployment explicitly in the Portal.
    publishToMavenCentral(automaticRelease = false)
    if (providers.gradleProperty("signingInMemoryKey").isPresent) {
        signAllPublications()
    }
    pom {
        name.set("Link Foundation UI for Kotlin")
        description.set("A Compose Multiplatform renderer for the Link Foundation UI dialect.")
        url.set("https://github.com/link-foundation/ui")
        licenses {
            license {
                name.set("Unlicense")
                url.set("https://unlicense.org/")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                name.set("Link.Foundation")
                organization.set("Link Foundation")
                organizationUrl.set("https://github.com/link-foundation")
            }
        }
        scm {
            url.set("https://github.com/link-foundation/ui")
            connection.set("scm:git:https://github.com/link-foundation/ui.git")
            developerConnection.set("scm:git:ssh://git@github.com/link-foundation/ui.git")
        }
    }
}

publishing {
    repositories {
        maven {
            name = "Staging"
            url = uri(layout.buildDirectory.dir("staging-repository"))
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
