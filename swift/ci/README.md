# Embedded Swift CI

The pipeline scripts and reusable workflow come from the
[Swift pipeline template v0.1.0](https://github.com/link-foundation/swift-ai-driven-development-pipeline-template/tree/0d91d2c3debe528bf92222411806931f44559f40)
under the Unlicense. The [Swift caller](../../.github/workflows/swift.yml)
qualifies the root package and the standalone Links Notation parser on
Ubuntu 24.04 and macOS 15. The caller also renders the macOS demo and uploads
its light and dark screenshots. Embedded mode leaves publication to this
repository's existing release workflow.

The caller lists each manifest's inputs. Specification changes qualify both
packages. Changes to the case-study samples also qualify the root package
and demo. JavaScript and Kotlin source changes outside those inputs skip
Swift compilation.

Run the formatter and strict checks from the repository root using Swift
6.4.1 and Python 3:

```bash
python3 swift/ci/check_swift.py --format Package.swift native/swift/LinksNotation packages/ui-swift examples/swift
python3 swift/ci/check_swift.py Package.swift native/swift/LinksNotation packages/ui-swift examples/swift
```

The existing pre-commit hook applies the same strict lint and size check
to staged Swift sources, including partial commits. It requires no Swift
toolchain for JavaScript-only or Kotlin-only commits. The vendored
`Tokens.swift` keeps the exporter's formatting and is checked byte for byte
by [the token parity test](../../tests/ui-swift-tokens.test.js).
`VocabularyText.swift` keeps the indentation of the embedded LiNo document.
`ProjectionTests` checks that its contents match the specification vocabulary.
