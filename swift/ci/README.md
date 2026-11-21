# Embedded Swift CI

The pipeline scripts and reusable workflow come from the
[Swift pipeline template v0.1.0](https://github.com/link-foundation/swift-ai-driven-development-pipeline-template/tree/0d91d2c3debe528bf92222411806931f44559f40)
under the Unlicense. The [Swift caller](../../.github/workflows/swift.yml)
qualifies the root package and the standalone Links Notation parser on
Ubuntu 24.04 and macOS 15. The caller also renders the macOS demo and uploads
its light and dark screenshots. Embedded mode leaves publication to this
[Swift publish workflow](../../.github/workflows/publish-swift.yml).

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

## Publishing

The two version sources are [`VERSION`](../../VERSION) and
[`native/swift/LinksNotation/VERSION`](../../native/swift/LinksNotation/VERSION).
Both start at `0.1.0`. Bump the version of each package whose published sources
change. The Publish Swift packages workflow runs the package tests and builds
independent clients against exact semver Git tags on Ubuntu and macOS. To
rehearse the same checks locally, run the following from a committed checkout:

```bash
python3 -B scripts/publish-swift.py verify
```

For the first release, provision a public GitHub repository named
`link-foundation/links-notation-swift` with `main` as its default branch. The
workflow exports the nested manifest, sources, tests, fixtures, and license
there so SwiftPM can find the parser manifest at the root. Configure the
`swift-release` Actions environment in `link-foundation/ui` with a
`PARSER_RELEASE_TOKEN` secret. Use a token scoped to the parser repository with
Contents write permission. The UI repository uses the workflow's built-in
token for its own tag and release.

After the PR merges and release is authorized, dispatch **Publish Swift
packages** on `main`:

```bash
gh workflow run publish-swift.yml --repo link-foundation/ui --ref main
```

A successful run creates a bare version tag and a GitHub release in each
repository, then builds and runs both consumer programs against the public
GitHub tags. The Swift UI release leaves the npm release's Latest status in
place. If publication stops after creating a tag, rerun the same workflow
run to finish the releases for that revision. The workflow checks existing
tags before reusing them and fails on conflicting contents.
