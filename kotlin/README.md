# Kotlin checks

Use the Gradle wrapper here to build and test the Kotlin projects together.
The [parser](../native/kotlin/links-notation/), [Compose renderer](../packages/ui-kotlin/)
and [desktop example](../examples/kotlin/) are included Gradle builds. They
also retain their standalone entry points, source paths and module coordinates.

From the repository root, using JDK 21:

```sh
cd kotlin
./gradlew :links-notation-kotlin:jvmTest :links-notation-kotlin:jsTest :links-notation-kotlin:wasmJsTest
./gradlew :ui-kotlin:check :ui-kotlin-example:build
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

[UI's release workflow](../.github/workflows/release.yml) continues to own
versioning and publication. The Kotlin quality workflow uses read-only
permissions, and the coordinator defines no publications.
