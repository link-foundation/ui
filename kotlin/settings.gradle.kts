rootProject.name = "ui-kotlin-checks"

// Keep the standalone builds and their dependency substitution available to
// consumers. Gradle flattens their nested includes into the same composite.
includeBuild("../native/kotlin/links-notation") { name = "links-notation-kotlin" }
includeBuild("../packages/ui-kotlin")
includeBuild("../examples/kotlin") { name = "ui-kotlin-example" }
