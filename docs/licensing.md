# Licensing

This document is the licensing policy of `link-foundation/ui`. The
repository is [REUSE 3.3](https://reuse.software/spec-3.3/) compliant:
`REUSE.toml` states the copyright and licence of every file, and `LICENSES/`
holds the text of every licence in use.

## Policy

- **Code** is public domain under the [Unlicense](../LICENSE) (R25).
- **Our own assets** are public domain under
  [CC0-1.0](../LICENSES/CC0-1.0.txt) (R26).
- **Vendored tool scripts** keep their own licence header. The Gradle
  wrapper of the Kotlin parser (`native/kotlin/links-notation/gradlew`,
  `gradlew.bat`) is Gradle's Apache-2.0 code, so
  [Apache-2.0](../LICENSES/Apache-2.0.txt) is in `LICENSES/`.
- **Third-party icons and assets** are allowed, but each one links to its
  source and states its copyright, licence and attribution (R27) in a record
  in [`assets/assets.lino`](../assets/assets.lino).

### Allowed by default

`Unlicense`, `CC0-1.0`, `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`,
`Apache-2.0`.

### Allowed only as an explicit opt-in

`CC-BY-4.0`, `CC-BY-3.0`, `CC-BY-SA-4.0`. The record must contain
`(opt-in true)` and `(attribution required)`.

### Denied

- any `*-NC-*` (non-commercial) or `*-ND-*` (no derivatives) licence;
- `LicenseRef-*`, unless listed below under "Allowed LicenseRefs";
- Remix Icon v1.0 or later (the "Remix Icon License v1.0");
- SF Symbols, SF Pro and Segoe;
- unlicensed sources (no licence, "See repository", "CC-ish" and other
  strings that are not SPDX identifiers);
- anything not on the two allow lists above.

### Allowed LicenseRefs

None yet. Adding one requires a change to this list and to
`DEFAULT_POLICY.allowedLicenseRefs` in `scripts/lib/asset-records.mjs`.

## Known problem sources

| Source                                                  | Problem                                                                                                                      | Decision                                                                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Remix Icon                                              | Moved to the custom "Remix Icon License v1.0" in January 2026; Fedora flagged it as not free. Older versions are Apache-2.0. | **Denied** for v1.0 and later. A pre-2026 Apache-2.0 release may be used only with an `Apache-2.0` record whose `source` pins that version. |
| SF Symbols, SF Pro, Segoe                               | Restricted Apple and Microsoft terms.                                                                                        | **Denied.** Never bundled; may only be named as a system font in a CSS font stack.                                                          |
| anime-avatar `ACS_GF2_MMD_MODEL_ARCHIVES`               | Hot-links about 70 proprietary SUNBORN Girls' Frontline 2 archives.                                                          | **Denied.** Neither bundled nor linked.                                                                                                     |
| anime-avatar DamagedHelmet model                        | Licensed CC-BY-NC.                                                                                                           | **Denied** (non-commercial).                                                                                                                |
| anime-avatar licence strings "See repository", "CC-ish" | Not SPDX identifiers.                                                                                                        | **Denied** until replaced with an SPDX expression.                                                                                          |
| konard.github.io                                        | No LICENSE file (GitHub reports `license: null`).                                                                            | **Denied** until the owner relicenses it upstream. Nothing may be copied from it.                                                           |
| meta-sovereign-chat `icons.js` (Lucide shapes)          | Lucide is ISC: permissive, but not public domain.                                                                            | **Allowed** with a third-party record: `(license ISC)`, `(copyright 'Lucide Contributors')`, `source` and `notice` links.                   |

Prior art: anime-avatar `attributionRequired()` and `AttributionOverlay`
([konard/anime-avatar#19](https://github.com/konard/anime-avatar/issues/19)).
Unlike them, we decide attribution from explicit fields, not from
licence-string heuristics.

## Record format

`assets/assets.lino` holds one Links Notation link per asset or asset group:
`(<id>: asset (field value)...)`. It is parsed with the official
`links-notation` package.

| Field              | Required        | Value                                                                      |
| ------------------ | --------------- | -------------------------------------------------------------------------- |
| `kind`             | yes             | `icon`, `image`, `font`, `sound`, `model`, `animation` or `data`           |
| `files`            | yes             | one or more quoted repository paths or globs under `assets/`               |
| `license`          | yes             | an SPDX expression; quote it if it contains spaces (`'MIT OR Apache-2.0'`) |
| `copyright`        | yes             | quoted text, or `none` for our own CC0-1.0 (or Unlicense) assets           |
| `source`           | third-party     | a quoted URL of the asset                                                  |
| `notice`           | third-party     | a quoted URL of the licence text                                           |
| `attribution`      | no (`none`)     | `required` or `none`                                                       |
| `attribution-text` | no              | quoted text to show wherever the asset is credited                         |
| `commercial-use`   | no              | `yes` or `no`                                                              |
| `modified`         | no              | `yes` or `no`                                                              |
| `opt-in`           | opt-in licences | `true`                                                                     |

A record is third-party when its `copyright` is not `none`.

```lino
(lucide-check: asset
  (kind icon)
  (files 'assets/icons/lucide/check.svg')
  (source 'https://lucide.dev/icons/check')
  (license ISC)
  (copyright 'Lucide Contributors')
  (notice 'https://github.com/lucide-icons/lucide/blob/main/LICENSE'))

(links-ui-logo: asset
  (kind image)
  (files 'assets/links-ui-logo.svg')
  (license CC0-1.0)
  (copyright none))
```

## Checks

- `npm run check:assets` (`scripts/check-assets.mjs`) fails when a file under
  `assets/` (other than `assets.lino`, `README.md` and `ATTRIBUTIONS.md`)
  matches no record or more than one, when a record matches no file or misses
  a field, when a licence is denied or is opt-in without `(opt-in true)`, when
  a third-party record has no `source` or `notice`, and when `REUSE.toml` is
  not what `node scripts/check-assets.mjs --write` would generate.
- `npm run assets:attributions` (`scripts/render-attributions.mjs`) writes
  [`assets/ATTRIBUTIONS.md`](../assets/ATTRIBUTIONS.md), grouped by licence;
  `--check` fails when it is stale. Its `renderAttributions(records, {format})`
  export renders `markdown`, `html` or `lino` for later in-app use.
- `pipx run reuse lint` checks REUSE compliance. The `reuse` tool is
  GPL-3.0; it runs in CI only and is never shipped or imported.

The [Licensing workflow](../.github/workflows/licensing.yml) runs all three on
pull requests and on pushes to `main`.

## Adding an asset

1. Put the file under `assets/`.
2. Add or extend a record in `assets/assets.lino`.
3. Run `node scripts/check-assets.mjs --write` and
   `node scripts/render-attributions.mjs`, and commit `REUSE.toml` and
   `assets/ATTRIBUTIONS.md`.
4. If the licence is new, add its text with `pipx run reuse download --all`.
