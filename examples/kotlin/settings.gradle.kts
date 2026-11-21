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
        // CI supplies a file-based Maven repository to test the release before upload.
        providers.gradleProperty("uiKotlinStagingRepository").orNull?.let { staging ->
            exclusiveContent {
                forRepository { maven { url = uri(staging) } }
                filter { includeModuleByRegex("io\\.github\\.link-foundation\\.kotlin", "ui-kotlin(-.*)?") }
            }
        }
        google()
        mavenCentral()
    }
}

rootProject.name = "ui-kotlin-example"
