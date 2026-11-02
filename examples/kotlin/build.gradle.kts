// The ui-kotlin example (issue #32): a Compose Desktop window that renders
// docs/case-studies/issue-1/samples/document.lino with UiView. It is the
// `example` project of packages/ui-kotlin; run it from there:
//
//     cd packages/ui-kotlin && ./gradlew run
//     ./gradlew run --args="--dark"
//     ./gradlew run --args="--screenshot ../../docs/screenshots/ui-kotlin-light.png"

plugins {
    kotlin("jvm")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
}

// Build outputs go under packages/ui-kotlin/build, not next to Main.kt.
layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("example"))

kotlin {
    // Any JDK 17 or newer that runs Gradle; the bytecode targets 17.
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

java {
    targetCompatibility = JavaVersion.VERSION_17
}

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
    implementation(project(":"))
    implementation(compose.desktop.currentOs)
}

val repository = rootProject.projectDir.resolve("../..").canonicalFile

compose.desktop {
    application {
        mainClass = "MainKt"
        jvmArgs += listOf(
            "-Dui.kotlin.document=${repository.resolve("docs/case-studies/issue-1/samples/document.lino")}",
            "-Dui.kotlin.theme=${projectDir.resolve("theme.lino")}",
        )
    }
}
