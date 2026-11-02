# Kotlin differential test

Compares the Kotlin Links Notation port (`native/kotlin/links-notation`) with
the JavaScript reference parser (`links-notation`, the version in
`package.json`) on random documents: the parsed links, the `formatLinks` text,
and for a refused document the error kind, line, column and full message.

```sh
(cd native/kotlin/links-notation && ./gradlew jvmJar)
kotlinc experiments/kotlin-differential/Differential.kt \
  -cp native/kotlin/links-notation/build/libs/links-notation-kotlin-jvm-0.1.0.jar \
  -d experiments/kotlin-differential/differential.jar
cd experiments/kotlin-differential
node differential.mjs 5000 1 64   # <count> <seed> <maxDepth>
```

Results for the port as committed (about 5,000 documents per seed):

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
