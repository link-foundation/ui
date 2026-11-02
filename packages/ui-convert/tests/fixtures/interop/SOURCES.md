# Interop fixture sources

The interop tests read these files. Files copied from other projects keep
their upstream content byte for byte (apart from the renames listed), and
`REUSE.toml` in this directory records their licences. Commits are pinned
so that each file can be compared with its upstream copy.

## A2UI (`a2ui/`)

Source: [google/A2UI](https://github.com/google/A2UI) at
[`6e9729920162be0143e8dbd5546b1e4967435baa`](https://github.com/google/A2UI/tree/6e9729920162be0143e8dbd5546b1e4967435baa/specification/v0_9_1/catalogs/basic/examples),
`specification/v0_9_1/catalogs/basic/examples/`. Licence: Apache-2.0,
Google LLC. The numeric prefix of each file name was dropped.

| Fixture                    | Upstream file                 |
| -------------------------- | ----------------------------- |
| `child-list-template.json` | `34_child-list-template.json` |
| `incremental.json`         | `00_incremental.json`         |
| `interactive-button.json`  | `00_interactive-button.json`  |
| `row-layout.json`          | `00_row-layout.json`          |
| `simple-login-form.json`   | `00_simple-login-form.json`   |
| `simple-text.json`         | `00_simple-text.json`         |
| `task-card.json`           | `07_task-card.json`           |

`coverage.json` was written for ui-convert (Unlicense). It covers two
surfaces with the same component ids, a deleted surface, the supported
basic catalog components, unknown keys, shared children, an unsupported
component and a data model built by path updates.

## Adaptive Cards (`adaptive-cards/`)

Source: [microsoft/AdaptiveCards](https://github.com/microsoft/AdaptiveCards),
`main` branch. Licence: MIT, Copyright (c) 2017 Microsoft.

| Fixture                 | Upstream file                                   | Commit    |
| ----------------------- | ----------------------------------------------- | --------- |
| `ActivityUpdate.json`   | `samples/v1.5/Scenarios/ActivityUpdate.json`    | `fe15495` |
| `CalendarReminder.json` | `samples/v1.5/Scenarios/CalendarReminder.json`  | `fe15495` |
| `InputForm.json`        | `samples/v1.5/Scenarios/InputForm.json`         | `fe15495` |
| `ShowCardWizard.json`   | `samples/v1.5/Scenarios/ShowCardWizard.json`    | `fe15495` |
| `Table.json`            | `samples/v1.5/Elements/Table.json`              | `72a8ae8` |
| `hc-sample.json`        | `samples/HostConfig/sample.json`                | `8ec3d29` |
| `hc-teams.json`         | `samples/HostConfig/microsoft-teams-light.json` | `8ec3d29` |

Full commits: `fe15495477905d2f83b27cb5a4acc8295da5fdc0`,
`72a8ae86c637dd5dba17869a2b9b672ad97b1718`,
`8ec3d2925d7af4747764faa413abaa2f983dd3b4`.

## JSON Forms (`json-forms/`)

Source: [eclipsesource/jsonforms](https://github.com/eclipsesource/jsonforms)
at `93aa34cbd5327f2c31e356cec40acf476c63b2ca`,
`packages/examples/src/examples/`. Licence: MIT, Copyright (c) 2019
EclipseSource GmbH.

| Fixture       | Upstream file | Change                                                                        |
| ------------- | ------------- | ----------------------------------------------------------------------------- |
| `person.json` | `person.ts`   | `schema` and `uischema` of the TypeScript module written out as one JSON file |
| `rule.json`   | `rule.ts`     | the same                                                                      |

`categorization.json` was written for ui-convert (Unlicense): a
`Categorization` with `Category` pages, a `Group`, a `ListWithDetail`,
nested controls and `HIDE` and `DISABLE` rules.

## Lottie (`lottie/`)

Source: [lottie/lottie-spec](https://github.com/lottie/lottie-spec) at
`4b55957472f8718e34e9c1298f0e8f021b6c597f`, `docs/static/examples/`.
Licence: MIT (sample code of the specification, see the upstream
`License.md`), Lottie Animation Community.

`ellipse.json`, `fill.json`, `path.json`, `rectangle.json`, `stroke.json`
and `transform.json` keep their upstream names.

Written for ui-convert (Unlicense):

- `dot-pulse.json`: a shape layer with animated opacity, position and
  scale.
- `dot-pulse.lino`: the LiNo animation of issue #61 (opacity and translate
  tracks), exported to Lottie by the tests.
- `rejected.json`: text, image and audio layers, effects, an expression, an
  image asset and a nested precomposition; every one of them must be
  rejected with a diagnostic.
