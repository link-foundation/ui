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
    versionCatalogs {
        create("libs") {
            from(files("../../kotlin/gradle/libs.versions.toml"))
        }
    }
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ui-kotlin"
