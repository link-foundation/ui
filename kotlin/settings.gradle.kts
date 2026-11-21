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

rootProject.name = "ui-kotlin-checks"

include(":parser-tests")
includeBuild("../packages/ui-kotlin")
includeBuild("../examples/kotlin") { name = "ui-kotlin-example" }
