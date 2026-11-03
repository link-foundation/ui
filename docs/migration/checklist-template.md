# Migration PR checklist template

Copy everything below into each migration PR (#66–#73). Replace placeholders
with paths, revisions, release numbers and evidence links; duplicate component
and screen lines for every inventory item. Mark an inapplicable item with its
reason. A blocked item stays unchecked with an upstream issue and the working
old implementation identified. See the [playbook](playbook.md),
[mapping](mui-mapping.md) and [index](README.md).

## Licence

- [ ] Target revision: `<SHA>`; licence path/SPDX: `<path, identifier>`.
- [ ] Every copied source is permissively licensed; owner licensed any previously unlicensed source before copying.
- [ ] Copyright, attribution, LICENSE/NOTICE and asset records are preserved; asset check: `<command/result>`.

## Inventory

- [ ] Pages/routes, components, stylesheets and line counts: `<paths/evidence>`.
- [ ] Settings keys, storage keys/formats, i18n sources and test suites: `<paths/evidence>`.
- [ ] Shared upstream extraction candidates and deployment/build commands: `<list>`.

## Contracts frozen

- [ ] Before-change compatibility tests cover storage keys/formats and URL hashes: `<tests>`.
- [ ] Tests preserve `data-*`, `data-testid`, CSS variables, global hooks and events/payloads: `<tests>`.
- [ ] Baseline tests pass; deliberate contract changes fail; rollback tested: `<evidence>`.

## Baseline screenshots

- [ ] Every page × theme × viewport/state captured: `<matrix, baseline SHA, links>`.
- [ ] Pinned environment, readiness and agreed difference threshold: `<details>`.
- [ ] Before/after images, keyboard and accessibility evidence: `<links>`; intentional differences: `<explanation or none>`.

## Tokens

- [ ] LiNo theme preserves old CSS variable names and values, nesting and scheme on first paint: `<paths/tests>`.
- [ ] Converter `unmapped` and contrast diagnostics reviewed; visual comparisons pass: `<evidence>`.

## Settings

- [ ] Versioned #23 schema and LiNo serialization with old JSON reader: `<paths/tests>`.
- [ ] Old JSON reader retained through at least release `<version>` (one release minimum).
- [ ] Corrupt/empty storage, old defaults/share hashes, validation, reload and rollback tested: `<tests>`.

## i18n

- [ ] #21 catalogs replace migrated literals; old `t()` signature and readiness events preserved: `<paths/tests>`.
- [ ] Locale persistence, fallback, interpolation, plurals, long text and RTL verified: `<evidence>`.

## Components

- [ ] `<component/path>` → `<framework element/version>`; upstream extraction `<PR>`; thin re-export `<path>`; contract, keyboard, screenshot and accessibility checks `<evidence>`.
- [ ] `<next component/path>` → `<element/version>`; extraction/re-export and checks `<evidence>`.

## Screens

- [ ] `<screen/route>` composed after its leaves; loading/error/empty states, navigation and focus tested: `<evidence>`.
- [ ] `<next screen/route>` verified across the baseline matrix: `<evidence>`.

## Deleted code

- [ ] Removed old components, CSS, parsers and unused dependencies: `<paths>`; remaining bridges/readers: `<paths and removal release>`.
- [ ] Same-method line counts: `<path: before → after>`; total reduction `<N>`; upstream moved lines reported separately `<N, PR/version>`.
- [ ] No consumers of deleted code; required repository gates, deployment and rollback pass: `<commands/results>`.

## New framework issues opened

- [ ] Missing framework pieces: `<issue links or none>`; working old implementations: `<paths>`.
- [ ] No local framework fork; blocked checklist items stay unchecked with explicit evidence and follow-up owners.
