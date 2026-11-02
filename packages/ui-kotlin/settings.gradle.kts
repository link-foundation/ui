// ui-kotlin: the Jetpack Compose / Compose Multiplatform renderer of the UI
// dialect (issue #32).

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ui-kotlin"

// The Kotlin Multiplatform Links Notation parser of issue #31, vendored in
// native/kotlin/links-notation until upstream publishes it
// (link-foundation/links-notation#370). Gradle substitutes its
// io.github.link-foundation:links-notation-kotlin coordinates with this build.
includeBuild("../../native/kotlin/links-notation")
