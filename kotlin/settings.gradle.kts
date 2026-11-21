rootProject.name = "ui-kotlin-checks"

// Coordinate the parser and renderer checks. The desktop example runs
// separately so Gradle resolves the renderer from a Maven repository.
includeBuild("../native/kotlin/links-notation") { name = "links-notation-kotlin" }
includeBuild("../packages/ui-kotlin")
