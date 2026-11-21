# Kotlin differential test

Compares the published Kotlin Links Notation parser with
the JavaScript reference parser (`links-notation`, the version in
`package.json`) on random documents: the parsed links, the `formatLinks` text,
and for a refused document the error kind, line, column and full message.

```sh
# Use the version pinned in kotlin/gradle/libs.versions.toml.
version=0.31.8
export LINKS_NOTATION_JAR="${TMPDIR:-/tmp}/links-notation-jvm-$version.jar"
curl --fail --location --output "$LINKS_NOTATION_JAR" \
  "https://repo.maven.apache.org/maven2/io/github/link-foundation/kotlin/links-notation-jvm/$version/links-notation-jvm-$version.jar"
kotlinc experiments/kotlin-differential/Differential.kt \
  -cp "$LINKS_NOTATION_JAR" \
  -d experiments/kotlin-differential/differential.jar
cd experiments/kotlin-differential
node differential.mjs 5000 1 64   # <count> <seed> <maxDepth>
```

Historical results for the original vendored port (about 5,000 documents per seed):

| Seeds | `maxDepth` | Mismatches |
| ----- | ---------- | ---------- |
| 1–5   | 64         | 0          |
| 6–8   | 2          | 0          |
| 9     | 0          | 0          |
| 11    | 64         | 0          |

The only expected difference: a malformed reference literal (`~1{zz}`,
`~1{ff}`, `~2{41}`) makes the JavaScript parser throw a `Parse error: …`
without a position, and the Kotlin port throws `ParseException.Syntax` at the
literal; the script counts those as agreeing.
