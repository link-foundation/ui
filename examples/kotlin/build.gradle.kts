// The ui-kotlin example (issue #32): a Compose Desktop window that renders
// docs/case-studies/issue-1/samples/document.lino with UiView.
//
//     cd examples/kotlin
//     ../../packages/ui-kotlin/gradlew run
//     ../../packages/ui-kotlin/gradlew run --args="--dark"
//     ../../packages/ui-kotlin/gradlew run --args="--screenshot ../../docs/screenshots/ui-kotlin-light.png"

plugins {
    kotlin("jvm") version "2.4.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21"
    id("org.jetbrains.compose") version "1.12.2"
}

kotlin {
    // Any JDK 17 or newer that runs Gradle; the bytecode targets 17.
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

java {
    targetCompatibility = JavaVersion.VERSION_17
}

// Main.kt sits at the top of examples/kotlin, next to this file.
sourceSets {
    main {
        kotlin {
            setSrcDirs(listOf("."))
            include("*.kt")
        }
        resources {
            setSrcDirs(emptyList<String>())
        }
    }
}

dependencies {
    implementation("foundation.link.ui:ui-kotlin:0.1.0")
    implementation(compose.desktop.currentOs)
}

val repository = projectDir.resolve("../..").canonicalFile

compose.desktop {
    application {
        mainClass = "MainKt"
        jvmArgs += listOf(
            // Skiko loads its native library; JDK 22+ warns without this.
            "--enable-native-access=ALL-UNNAMED",
            "-Dui.kotlin.document=${repository.resolve("docs/case-studies/issue-1/samples/document.lino")}",
            "-Dui.kotlin.theme=${projectDir.resolve("theme.lino")}",
        )
    }
}
