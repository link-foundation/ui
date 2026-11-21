#!/bin/sh
# Runs the compiled Kotlin side of the differential test.
dir=$(dirname "$0")
exec java -cp "$dir/differential.jar:${LINKS_NOTATION_JAR:?Set LINKS_NOTATION_JAR to the published JVM artifact}:$(dirname "$(command -v kotlinc)")/../lib/kotlin-stdlib.jar" DifferentialKt "$@"
