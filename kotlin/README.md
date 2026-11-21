# Kotlin checks

Use the Gradle wrapper here to build and test the Kotlin projects together.
The [parser](../native/kotlin/links-notation/) and the
[Compose renderer](../packages/ui-kotlin/) are included Gradle builds.

From the repository root, using JDK 21:

```sh
cd kotlin
./gradlew :links-notation-kotlin:jvmTest :links-notation-kotlin:jsTest :links-notation-kotlin:wasmJsTest
./gradlew :ui-kotlin:check
```

Set `ANDROID_HOME` to an SDK with platforms 36 and 37 for the Android
library builds. Run `:links-notation-kotlin:iosSimulatorArm64Test` on an
arm64 Mac with Xcode and an iOS simulator.

The [Kotlin caller](../.github/workflows/kotlin.yml) lists the included builds
and shared inputs that select Gradle checks. Its reusable workflow adapts the
[merged Kotlin template](https://github.com/link-foundation/kotlin-ai-driven-development-pipeline-template/blob/9ba20ee1a6ce339057491ed4090f951ddfd937f3/docs/monorepo.md)
to UI's runners, test suites and terminal status check. Pull requests are tested
on GitHub's merge checkout. The terminal status also runs when the change has
no Kotlin inputs and all Gradle jobs skip.

The Kotlin quality workflow uses read-only permissions. It stages the
renderer artifacts and builds the [desktop example](../examples/kotlin/)
separately against the staged Maven repository.
See the [renderer README](../packages/ui-kotlin/README.md#maven-central-publication)
for local staging and the Maven Central workflow.
