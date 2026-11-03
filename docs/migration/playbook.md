# Migration playbook

Use the [checklist](checklist-template.md) for each migration PR and the
[MUI/Chakra mapping](mui-mapping.md) when translating UI. Return to the
[index](README.md) for example pairs and related migration issues.

Follow the [strangler fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html):
keep the existing entry points, route a small piece through the framework,
and retire the replaced implementation only after compatibility checks pass.
Record evidence in the target repository's PR, not only in an agent session.

## 1. Licence gate

**Entry criteria:** The target revision and every source proposed for extraction
are identified, including fonts, icons and dependencies.

**Actions:** Read each licence and NOTICE; record paths, SPDX identifiers,
copyright and provenance using the [licensing policy](../licensing.md).
Only copy Unlicense, CC0 or other permitted permissive sources. If a target
has no licence, its owner must add one first; public visibility grants no
permission to copy. Check the current licence of konard.github.io rather
than assuming the historical research still applies. Preserve notices and
record third-party assets in `assets/assets.lino` when bringing them upstream.

**Exit checks:** Licence evidence covers every proposed extraction;
`npm run check:assets` passes for new framework assets. An unlicensed source
blocks copying until its owner supplies a compatible licence.

## 2. Inventory

**Entry criteria:** The licence gate permits the planned work.

**Actions:** List every page/route, shared and leaf component, stylesheet
(with line counts), settings key, storage key and format, i18n source and test
suite. Give each an exact file path and owner/consumer; include global scripts,
URL hashes, CSS variables and build/deploy entry points. Mark duplicated
behavior and candidate upstream extractions. Save before counts with
`wc -l path/to/file` and preserve the baseline revision.

**Exit checks:** Each inventoried item has a path, migration destination and
verification command. Existing tests and the deployment build pass before edits.

## 3. Freeze contracts

**Entry criteria:** The inventory identifies external consumers.

**Actions:** Write compatibility tests before changing code for storage keys
and serialized formats, URL hashes, `data-*` attributes, CSS variable names,
`data-testid` values, global hooks and emitted/listened events (including
payloads). Use fixtures from real previous releases with sensitive data removed.
Assert the existing public behavior, including malformed input and fallbacks.
Keep thin adapters at those boundaries while internals change.

**Exit checks:** Tests pass against the baseline and fail when a frozen key,
format or event is deliberately changed. Record intentional contract changes
and a compatibility/rollback plan before proceeding.

## 4. Baseline screenshots

**Entry criteria:** Contracts are tested and the baseline build is reproducible.

**Actions:** Use the target's Playwright setup, or the [#13 harness](../testing-ui.md).
Capture every page × theme × viewport, including important interaction states
such as validation, menus and dialogs. Pin browser/fonts, seed data and clocks,
wait for readiness, and agree a visual difference threshold before editing.
Include keyboard focus, reduced motion, color scheme and accessibility checks.

**Exit checks:** The matrix has committed baselines and a passing comparison
run; the PR identifies the baseline SHA, environment and threshold. Reviewers
can inspect screenshots before and after each replacement.

## 5. Tokens first, zero visual change

**Entry criteria:** Visual baselines and frozen CSS variable contracts exist.

**Actions:** Move CSS custom properties into a LiNo [theme](../spec/themes.md)
([#47](https://github.com/link-foundation/ui/issues/47)). Use ui-tokens CSS
output and preserve the exact old variable names. `cssVariable('fa.surface.card')`
produces `--fa-surface-card`; select matching token paths or retain a small
explicit alias bridge for names that cannot be generated identically.
Preserve nested themes and light/dark/high-contrast/reduced-motion choices.
For MUI, use the [#48 converter](../themes/material3.md), review `unmapped`,
and override imported tokens to match the old appearance before adopting new
Material defaults. Check contrast adjustment diagnostics too: they can change colors.

**Exit checks:** All old custom properties resolve to the same values, first
paint has the same scheme, and the complete screenshot matrix stays within the
agreed threshold. Record any reviewed intentional differences in the PR.

## 6. Settings as LiNo

**Entry criteria:** Settings/storage contracts and token application are tested.

**Actions:** Define the [#23 schema](../../packages/ui-settings/README.md) with
version, defaults, bounds, migrations and application hints. Serialize new values
as LiNo through the package API. Keep a reader for the old JSON format for at
least one release; validate decoded values before merging them into the schema.
Preserve storage keys and share hashes through an adapter; distinguish old JSON
from new LiNo explicitly. Test empty/corrupt storage, old defaults, rejection,
reload, before-paint application and old share URLs. Retain old data or a backup
until rollback to the previous release is verified; changing writes under an
old key may require dual writes during the compatibility window.

**Exit checks:** Old fixtures load to the expected values, new LiNo round trips,
contracts and screenshots pass, and the PR states the earliest release in which
the JSON reader may be removed. Rollback still reads usable settings.

## 7. i18n

**Entry criteria:** Current catalogs, locale selection and `t()` callers are known.

**Actions:** Move strings to [#21 LiNo catalogs](../../packages/ui-i18n/README.md).
Keep the old `t()` signature behind an adapter to the localizer; preserve key
names, interpolation, plurals, fallbacks, locale persistence and readiness events.
Replace hard-coded strings in migrated components, including accessible names.
Check long translations and right-to-left layout before deleting old catalogs.

**Exit checks:** Existing callers work without signature changes; catalog,
locale-switching and fallback tests pass. Screenshots cover representative long
and right-to-left text, with correct accessible labels and document direction.

## 8. Leaf components, then screens

**Entry criteria:** Tokens, settings and translations have compatible bridges.

**Actions:** Extract reusable behavior upstream first, with tests and a released
framework version. If a piece is missing, open an upstream issue and keep the
working old component until it exists. Replace one leaf component per PR behind
a thin re-export retaining imports and the public prop/event contract. Use the
[mapping](mui-mapping.md) and [paired examples](README.md#before-and-after-examples).
Compose screens only after their leaves pass. Preserve routing, loading, errors,
empty states, focus restoration and keyboard interaction. The
[#59 importer](../../packages/ui-convert/README.md) is optional: review its
unsupported diagnostics and generated LiNo as carefully as a manual translation.
[#58 dev mode](../../packages/ui-devmode/README.md) can inspect the old page.

**Exit checks:** Each replacement passes frozen contracts, interaction tests,
visual comparisons and accessibility checks. Each PR is deployable and its
re-export can be rolled back. Every screen in the inventory has evidence before
moving on to deletion.

## 9. Delete

**Entry criteria:** All consumers use verified replacements; the settings
compatibility window has elapsed for any reader proposed for removal.

**Actions:** Remove superseded components, CSS, duplicate helpers and hand-written
LiNo parsers. Parse LiNo with the official `links-notation` package through the
framework APIs. Check references before deleting re-exports, old catalog files
or dependencies. Keep still-needed contract bridges. Record before/after line
counts using the same paths/counting method, separating moved code from deletion
and noting the upstream extraction PR/version.

**Exit checks:** No runtime imports or consumers reach removed code. Tests,
deployment build, screenshot matrix and accessibility checks pass. The PR lists
removed files, line-count reduction, compatibility readers retained and a tested
rollback. Every inventoried item is accounted for.

## Rules

- Every step leaves the application working and deployable; ship small PRs with
  a reversible boundary and keep compatibility tests throughout the migration.
- Take screenshots before and after. Differences must stay within the agreed
  threshold or have an explicit explanation and reviewer agreement in the PR.
- Extract shared code upstream first. If the framework lacks a piece, open a
  [framework issue](https://github.com/link-foundation/ui/issues/new); link the
  gap and keep the old piece working. Do not maintain a local framework fork.
- Reuse existing test infrastructure and run focused checks during development;
  run required repository gates and deployment checks before handing off a PR.
