// The ui-kotlin example (issue #32): its own build, so that it runs from this
// directory with the wrapper of packages/ui-kotlin:
//
//     cd examples/kotlin && ../../packages/ui-kotlin/gradlew run

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

rootProject.name = "ui-kotlin-example"

// Gradle substitutes the foundation.link.ui:ui-kotlin coordinates with this
// build (and, through it, the Links Notation parser of native/kotlin).
includeBuild("../../packages/ui-kotlin")
