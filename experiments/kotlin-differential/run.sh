#!/bin/sh
# Runs the compiled Kotlin side of the differential test.
dir=$(dirname "$0")
exec java -cp "$dir/differential.jar:$dir/../../native/kotlin/links-notation/build/libs/links-notation-kotlin-jvm-0.1.0.jar:$(dirname "$(command -v kotlinc)")/../lib/kotlin-stdlib.jar" DifferentialKt "$@"
