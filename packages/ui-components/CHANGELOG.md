# @link-foundation/ui-components

## 0.4.0

### Minor Changes

- 562b96b: Publish standalone browser-ready modules for eight Simple Icons brand marks that applications can import individually.

  Size Telegram embeds with the official widget, support host availability checks and archive layouts, and forward X and VK widget options.

## 0.3.0

### Minor Changes

- 8ee76a0: Share fitted doublet artwork across network previews, SVG and raster exports,
  decorative glyphs, and gallery thumbnails. Add palette and per-link colours,
  line joins, force placement controls, captions and titles. Read legacy editor
  bookmarks and expose host panel mounts, a headless model, editor messages and
  configurable share destinations.

## 0.2.0

### Minor Changes

- a377df7: Accept established Links Notation, base-number and associative-theory inputs in network editors. Expose validation parameters and formatting options for one-line Links Notation and the N² theory label.

## 0.1.2

### Patch Changes

- 6a56e7d: Update Links Notation to 0.31.8 and the Link CLI client used by the ui-links integration tests to 0.5.0.
- Updated dependencies [6a56e7d]
  - @link-foundation/ui-core@0.1.4

## 0.1.1

### Patch Changes

- Point the VK embed documentation to an archived snapshot of the official post widget reference.

  Skip the pull request release dry run when the merged checkout has no pending changesets.

- Updated dependencies
  - @link-foundation/ui-core@0.1.1

## 0.1.0

### Minor Changes

- Add activity chart kinds (calendar, range, composition and tag cloud), logarithmic
  scales, rounded bars and direct labels, row emphasis, rich top-layer tooltips,
  and compact stat tiles with hints and footnote links. Include accessible titles,
  keyboard navigation, data tables and an activity gallery.

  Add adaptive per-effect quality, frame-rate caps, elapsed time, paused repaints, and optional visibility and reduced-motion inputs to the effect governor.

  Add the agent guide (`AGENTS.md`, `CLAUDE.md`, `docs/agents/`), GitHub Feature and Bug issue forms and a pull request template that mirror the roadmap issue template, with a test that keeps the Feature form in the template's section order.

  Add the framework documentation site with English and Russian LiNo pages,
  static ui-dom rendering, saved theme preferences and runtime inspection.

  Make shared fixture cleanup verification distinguish Linux process identity,
  zombies and reaped descendants, with deterministic race regression coverage.

  Make each synced write cost its own size rather than the cache's: settle
  compares only the addresses a write can change, the checkpoint is not built
  without a `saveState`, name deliveries decode the names once through
  `LinksNames.namesOf`, and long in-process flushes yield to timers so a test
  timeout can fire.

  Add the optional Simple Icons brand adapter, app-selected static icon subsets,
  filled icons, stroke width and size attributes, and localized inline icon
  message parts with accessible labels.

  Fix loading from clink when unsupported extensions return an empty query reply. Verify the synced client against released clink with permissions and subscriptions, and document the remaining compatibility differences.

  Provide typed browser conversion and localization entry points, use the DOM import entry in foreign dev mode, and bundle inspector assets in external Vite production builds without consumer transforms.

  Extract the release fixture setup so the changeset formatter test stays within the repository's function-length limit.

  Add a provider-neutral LiNo chat kit with bounded bidirectional history, anchored message streams, capability-driven actions, a growing composer, nested reasoning and four appearance skins.

  Ship classic DeepCase, konard, immortality, formal-ai and meta-sovereign theme packs,
  with nested chat/composer axes, a frame generator, and validated surface and graph styles.

  Preserve the classic dark radial menu preference when loading a theme.

  Extract CodeMirror LiNo plugin setup into a helper so strict repository lint passes.

  Keep only theme defaults and control templates in the documentation site's
  client registry, using its precompiled CSS instead of bundling resolved tokens.

  Rebase pending doublets edits on server replies, pushes and loads, retaining confirmed state across refusals and reloads. Reject writes depending on refused creates without leaving phantom temporary links. Verify reference permissions against released clink in the shared contract and example.

  Reuse existing permission rule pairs and marks so repeated grants are idempotent and exported grants survive clink's doublets uniqueness resolution.

  Complete the missing MUI core equivalents (#164). `ui-components` gains the
  `container`, `paper`, `card` and `app-bar` layout surfaces, a `chip` with an
  optional remove action, an `accordion` built on the disclosure machine, and
  `(shape circular)` on `progress`, which keeps its determinate and indeterminate
  ARIA. `ui-core` adds them to the shared vocabulary. The Material 3 theme of
  `ui-themes` styles them and its MUI mapping names them.

  Add LiNo listboxes, trees and tables with shared measured virtualization,
  selection, stable sorting, lazy tree children, accessible keyboard navigation
  and data event actions. Export pure range models for timeline reuse.

  Add a DeepClient data adapter, minilinks queries and named applies over synced
  triplets, including optimistic remaps, linked values and permission checks.
  Add a clink GraphQL transport with both subscription protocols and an example
  running the upstream Deepcase graph and React hooks.

  Add opt-in deferred provider embeds with validated X, Telegram and VK adapters,
  shared script loading, timeout fallback, archived content, localized iframe titles
  and generation-safe theme updates.

  Add the design guidelines digest in `docs/guidelines/`: a component catalogue and token taxonomy mapped to WAI-ARIA APG, Open UI, Material 3, Fluent 2, Apple HIG, MUI and DTCG, stored as LiNo with a consistency test.

  Add a LiNo WYSIWYG designer with docked panels, transactional visual editing,
  snapping, keyboard paths and source-preserving two-way synchronization.
  Use the shared CodeMirror LiNo editor for Source, with inline diagnostics.
  Allow editor adapters to toggle read-only mode without losing focus or copying.
  Keep CodeMirror's native clipboard usable in Safari while its state blocks edits.
  Keep designer control renderers local to each mount so host renderers stay intact.
  Expose the devmode property grid and overlay for reuse by the designer.
  Resolve devmode model policy declarations through package exports for Deno.
  Patch positional store edits in place so defaults and source/property edits
  appear immediately on the canvas, preserving explicit properties and DOM
  identity through undo/redo.

  Make the doublet renderer draw the clean `22 11` input of the collision solver
  without painted collisions:
  - Fixed end angles turn toward the mirror side.
  - Links whose two references cancel share one middle direction.
  - Start and end gaps at another link's middle move the visible end back along
    its tangent.

  Add the shared LiNo fixture and a painted regression test.

  Add exact doublet-network enumeration, numeric and Links notations, editing helpers,
  renaming classes and a paginated, localised links-gallery built on links-network.

  Add an opt-in default doublet network provider with continuous cubic links,
  point-symmetric loops, turns and arc-length gaps, nine parametric markers,
  marker-aware fitting, placements and shared accessible SVG/raster styling.

  Retain browser regression coverage for restoring independently autosaved editor drafts before reload.

  Wait for both editor drafts to persist before testing reload restoration, avoiding a race between independent autosave timers in WebKit.

  Prepare the first versioned release of every runtime workspace for external npm consumers, including generated component assets and package licenses. Verify production-only archive installation with a standalone Vite/React consumer.

  Add the Fluent 2 LiNo theme with light, dark and high-contrast schemes, a 16-stop
  brand-ramp helper, a shared React migration mapping loader and an accessible
  control gallery. Fluent token data remains a development dependency only.

  Support original token metadata, non-text contrast minimums, inherited system
  colors and scoped native part states. Keep subtree focus rings visible and
  accept secondary and transparent button variants across the shared vocabulary.

  Inspect and edit foreign DOM pages with persistent LiNo overrides, subtree export,
  a configurable bookmarklet and a private Manifest V3 extension. Allow DOM imports
  to exclude inspector hosts before assigning structural IDs.

  Initialize grids without named areas safely and cancel queued child refreshes when layout controllers are destroyed.

  A reference needs a right: without it an unreadable address answers `Link not found`, exactly as a missing one, so a subject can no longer learn that a hidden link exists. Add the `AllowReference` rule (`allow(links, markers, 'reference', subject, object)`) and `policy.canReference`; a rule naming a type, reading a link, or being the link also allows it. Choosing the address of a new link and resolving a name follow the same rule. `allow(links, markers, 'reference', markers.anything, markers.anything)` restores the previous behaviour.

  Add HIG-guided iOS and macOS themes, scalable text, accessible controls, optional materials, spring easing and a shared SwiftUI mapping. Extend the theme vocabulary and DOM attributes for materials, text styles and segmented controls, and anchor scoped theme rules to their boundary.

  Fix HIG material CSS selectors by preserving theme-root alternatives, native
  parts and host interaction states without a literal boolean suffix.

  Add host network geometry/solver/export providers, bounded JPEG/WebP raster exports, independent pixel frame schemas, optical material parameters and a comfort-aware effect governor.

  Add a pure Kotlin Multiplatform Links Notation parser under `native/kotlin/links-notation/`, with a vendored copy of the upstream parity corpus (`native/parity/`). It passes that corpus and the ui-dialect/0 parser vectors (`docs/spec/parser-vectors.json`, including the reference error messages) on JVM, Android, iOS, JS and Wasm (`docs/native-parsers.md`).

  The repository is now REUSE 3.3 compliant: `REUSE.toml` and `LICENSES/` record the Unlicense for the code (including this package) and CC0-1.0 for our own assets, and third-party assets are recorded in `assets/assets.lino` and checked in CI.

  Add links-network with deterministic layouts, cancellable workers, incremental
  store updates, SVG/Canvas rendering, keyboard and pointer interaction, label
  level of detail and SVG/PNG exports.

  Write Links Notation in the nested (indented) form by default, with as few parentheses as possible (#133). The one-line and parenthesized forms still read the same.
  - ui-core: `format` and `formatLinks` default to `style: 'indented'`, and `formatLinks` also takes `links-notation` links. The new `parseNested`/`parseLinks` read the nested form back without path folding. `moveNode` can move the last lines of a nested element.
  - The writers of the other packages now write the nested form:
    - dock layouts, charts, chart themes, diagrams and split sizes (ui-components)
    - the importers, rules and mappings (ui-convert)
    - the element source panel (ui-devmode)
    - values documents (ui-settings)
    - bundles and logs (ui-store)
    - DTCG import (ui-tokens)
    - the Swift and Kotlin `dumpLino` render trees

    The ui-settings share URL stays on one line.

  - The `.lino` files, docs and examples are written in the nested form. `scripts/lino-nest.mjs` converts a file, `--check` lists the files that are not nested, and `--verbose` traces each group. `tests/lino-nested-form.test.js` keeps the repository nested.
  - The GitHub issue templates are removed.

  Add a native WebSocket transport for browser, Node.js, Deno and Bun clients and
  an isolated Node.js server using ws. Support text and binary Links Notation,
  ordered replies, subscription pushes and offline outbox retention.

  Add arbitrary Links Notation to network conversion and round trips, source-linked selection in the lino-network element, and a Node CLI that exports SVG with the existing network layouts.

  Make key offsets literal iteration time positions. Animation easing now defaults
  per segment, with explicit key easing overriding it, in both the pure sampler and
  WAAPI player. This changes previous global-easing interpolation and compiled
  WAAPI output while preserving animation source and the timeline midpoint.

  Add live sound bus controls, humanized stereo playback, runtime event mapping,
  voice preview, sticky activation and visibility handling, generated comfort
  settings, and delegated document interaction binding. Render generated choice
  labels without changing their stored voice names.

  Bind a UI store to a synced links document, with stable element handles,
  incremental writes, remote store operations and server refusal rollback.
  Keep transactions with origin `links` out of undo history.

  Add the Material 3 theme, seed color generator, MUI theme converter and parsed component mapping. Support elevated button and filled/outlined text-field variants in the control vocabulary and DOM attributes.

  Preserve Material 3 token source metadata and correct scoped theme styles on descendants and control boundaries.

  Document the migration playbook, MUI and Chakra mappings, and copyable PR checklist. Add three paired JSX/LiNo examples with parser and exported-kind regression checks in the repository test suite.

  Add the React Native New Architecture renderer, pure primitive and style mapping, incremental store subscriptions and named action dispatch.

  Expose the in-memory store through `/memory` so native bundlers do not load optional IndexedDB or WebAssembly persistence adapters.

  Add LiNo theme inheritance, contrast-safe modes, scoped CSS, DTCG Resolver
  exports, before-paint restoration and the base theme package. Render nested
  theme boundaries without replacing controls, honor user comfort choices and
  let the native button consume theme part templates.

  Add network editor adapter panels, a declarative option schema with URL round trips,
  held-input URL synchronization, style presets and sharing through presentation backends.

  Add optical material parameters, deterministic grain, opt-in backdrop refraction and viewport budgeting, scoped appearance presets, palette packs and optional RGB channel exports for alpha composition. Raise the style glow range to four.

  Add LiNo overlay and navigation kinds, native dialogs and popovers, Floating UI positioning shared with select, accessible menus and context menus, horizontal-label radial menus, tabs, drawers, and pausable toast queues. Add close/select action events and the shared dialect vocabulary.

  Add a persistent synced-client opener that restores the cache, LiNo outbox,
  temporary addresses and subscriptions through the persistence adapters.
  Replay writes and reconcile readable server links on reconnect.

  Verify positional DOM updates preserve named button properties, event handlers,
  and undo behavior, including browser accessibility coverage.

  Add independently importable starfield, shader backdrop, grid beam, glyph rain
  and CSS grid layers with a shared governed lifecycle and an original nebula preset.

  Declare the DOM type library used by the shared effect governor so browser layers
  can consume its public types under Deno as well as browser TypeScript projects.

  Fix select keyboard, focus, labeling and viewport sizing contracts. Add live
  number drafts, inherited fallback stepping, RGB and named color palettes, rich
  settings panel extension hooks, saved looks and before-link recovery. Expose
  settings normalization policies, compatibility codecs and before-paint readers,
  and changed-only CSS projection with inheritance and derived values.

  Expose directional numeric snapping, grouped RGB sliders and channel editors,
  and replaceable message catalogs for panel chrome and field-specific actions.

  Keep continuous typed number values with an independent opt-in clamp policy;
  generated number editors inherit the settings engine normalization policy.

  Push subscription creations and deletions when permission rules or type inheritance change, with a server-local readable-types cache and targeted rule invalidation.

  Give the example's Forget saved changes button an explicit theme-aware surface so WebKit paints and accessibility tools measure the same accessible colors.

  Load a connected lino-network element's source once during custom-element upgrade, avoiding an immediately aborted startup fetch. Add optional source-load tracing.

  Add opt-in Web Audio sound themes, quiet and immortality synthesizer patches,
  framework event binding and viewer-owned volume and mute settings.

  Keep optional doublets-web WASM out of DOM renderer and foreign inspector builds
  by using the memory store entry. Export GENERATED_ID_PREFIX from that entry while
  preserving the root WASM adapter APIs.

  Record store operations, inputs and animation starts as redacted Links Notation. Replay and seek deterministic sessions, verify input-only state changes and export Playwright tests.

  Add build-time independent frame CSS, live frame parameters and opt-in threshold fitting. Extend the frame vocabulary with scaled block inheritance, modes, corner line kinds, edge styles and stroke opacity; accept bounded computed clip polygons and dotted borders in ui-style.

  Add scrolling page and section navigation with logical edge fades, titled sections,
  whole-link card grids, and localized quick preference controls bound to comfort settings.

  Add stable balanced settings columns, accessible section tabs and levels, live preset cards, persistent saved-look management and collections, share-link recovery, constrained randomization, opt-in storage synchronization, a colour chooser popover, inheritable numbers and bounded steppers.

  Generate an accessible settings panel from a Links Notation schema, with basic controls, resets, search, presets, live preview, diff import/export and share links in page and non-modal drawer modes.

  Stabilize overlay theme accessibility tests by auditing each scheme after its screenshot settles, with deterministic transition and contrast regression coverage.

  Use the editor's keyboard selection when replacing draft text in browser tests, preserving exact draft contents through selection restoration.

  Export writable UI overrides as deterministic LiNo, budgeted share links and
  agent instructions. Validate shared changes before session previews with a
  Before the link backup, Keep/Discard banner and accessible defaults dialog.

  Add opt-in site build phase timings (`SITE_BUILD_TRACE=1`) and make the site
  build test terminate and reap its Vite build at a finite deadline in every
  test runtime, including Bun, whose runner does not abort `t.signal`.

  Add cancellable solver job execution with module-worker lifecycle management and a synchronous fallback. This execution layer does not implement the default collision algorithm.

  Add a multi-document source editor with lazy CodeMirror 6 and optional Monaco engines, LiNo syntax highlighting and parser diagnostics, persistent drafts, conflict choices and accessible keyboard navigation.

  Align the `ui-dialect/0` reference projection with path folding: a multi-line anonymous child declares its head once, an unfoldable path link is kept once in `unknown`, and an unknown sublink with indented lines stays one `unknown` value in all three forms. Add the `shapes/nested-anonymous`, `shapes/unfoldable-path` and `shapes/unknown-children` fixtures and state these rules in `docs/spec/projection.md`.

  Split the ui-links session setup and per-subscription delivery out of `openSession` so it fits the function-size lint rule; behaviour is unchanged.

  Support attribute part lookups in static control templates so registered buttons render in server generated galleries.

  Add the Swift Links Notation parser (`native/swift/LinksNotation`, a SwiftPM package checked against the upstream parity corpus) and `docs/spec/parser-vectors.json`, the parser vectors generated from the `ui-dialect/0` fixtures by `scripts/generate-parser-vectors.mjs`, with the Swift CI workflow and `docs/native-parsers.md`.

  Add triplets: `withTriplets` over any storage with link-cli's encoding, substitution queries with three-part links in `runQuery`, a triplet mode of the links server (`createLinksServer({ triplets: true })`) that replays link-cli's `docs/protocol/triplets.txt`, and `createSyncedTriplets`, a synced client that also works through `clink --serve --triplets`.

  Add the animation and recording timeline with source-preserving edits, undo, keyboard controls and canvas preview.

  Add `@link-foundation/ui-animation`: animations written in Links Notation (`animation` links with keyframe tracks, cubic-bezier, steps and spring easings, procedural effects such as the seeded `decipher`, additive layers with bell and sustain envelopes, `(reduced-motion ...)` variants and `(on STATE ...)` triggers; `timeline` links with `at`, `sequence`, `parallel` and `stagger`), a pure seeded sampler, safety validation (persistent fills on clip-path and transforms, WCAG 2.3.1 flashes, missing reduced motion), a WAAPI compiler with springs as CSS `linear()`, and a player with an injectable clock that follows `data-motion` and `prefers-reduced-motion` and plays the triggers of a ui-store document. GSAP is never used.

  Add `@link-foundation/ui-components`: behaviour state machines written in LiNo (`initial`, `context`, flat states with `on`/`target`/`do`/`when`, `entry`, `exit`, `after` delays on an injected clock, and `parts` with `attr` and `key`), `parseMachine` with diagnostics and a DOM-free `interpret` (`./behavior`); `createActionRegistry` with the vocabulary defaults, where unknown actions are diagnostics and `navigate` rejects `javascript:` URLs; the `toggle` and `disclosure` reference machines; `mountBehavior` for ui-dom documents (`./behavior/dom`); and accessibility helpers (`./a11y`): focus trap, roving tabindex, typeahead, key bindings, a live region announcer and `bindMachine`. ESLint forbids `eval`, `new Function` and string timers in the package. ui-dom gains an `isAction` render option so registered actions outside the vocabulary are dispatched; ui-core's vocabulary gains the `machine` kind.

  Add charts to `@link-foundation/ui-components` (`./charts`), written in Links Notation in the grammar of Vega-Lite: `data`, `mark` (line, area, bar, point, arc), `encoding` (x, y, color, size, theta, tooltip), `title` and `description`. `chartFromLinks`/`parseChart` read a spec and throw a `ChartSpecError` with the link position; `chartToLino` writes it back. `renderChartSvg` renders a deterministic SVG with the pinned d3-scale and d3-shape. `<ui-chart>` shows it as `role="img"` named by the description, with a data table twin behind a "Show data table" button and arrow-key navigation between points announced through `aria-live`. `<ui-stat-tile>`, `<ui-gauge>` and `<ui-sparkline>` are small charts. The chart colour tokens `color.chart.1`–`color.chart.8` have at least 3:1 contrast in light and dark. `toEChartsOption` (`@link-foundation/ui-components/charts/echarts`) is a pure ECharts adapter, and ECharts, an optional peer dependency, is loaded only for `(renderer echarts)`.

  Add the basic controls to `@link-foundation/ui-components` (entry points `./controls` and `./controls.css`, also exported from the package root): `button`, `icon-button`, `label`, `link`, `text-field`, `text-area`, `number-field`, `color-field`, `checkbox`, `radio-group` and `radio`, `switch`, `slider`, `select`, `combobox` and `option`, `progress`, `badge` and `avatar`. Each is a ui-dom kind over native elements with its WAI-ARIA pattern (keyboard, roles and states), a LiNo behaviour machine when it has state, stories in `stories/<kind>.lino` and a catalog entry. `mountControls` writes every committed value to the store in one transaction before the `(on change ...)` handlers run, the input controls submit with their native form, and `controls.css` uses only design tokens.

  Add the basic control kinds to the ui-dialect vocabulary (`docs/spec/vocabulary.lino` and its `ui-core` copy): `icon-button`, `label`, `link`, `text-field`, `text-area`, `number-field`, `color-field`, `checkbox`, `radio-group`, `radio`, `switch`, `slider`, `select`, `combobox`, `option`, `progress`, `badge` and `avatar`. ui-dom maps the UI event `change` to the `ui-change` event a control dispatches once per committed value, and gives a kind renderer `ctx.children()`, the element models of its children. With these kinds in the vocabulary, the ui-convert HTML import maps `<a>`, text `<input>`, checkbox `<input>` and `<textarea>` to `link`, `text-field`, `checkbox` and `text-area` (keeping their attributes and styles), and the ui-devmode inspector edits `element-ref-or-url` properties as text.

  Add `@link-foundation/ui-components` with diagrams written in Links Notation: a `diagram` dialect (`kind`, `direction`, `node`, `edge`, `group`) that round-trips through LiNo, a deterministic Dagre layout with layout plugins (`(layout NAME)`), an accessible SVG renderer, `toMermaid` export, and the `<ui-diagram>` and `<ui-mermaid-view>` elements. The Mermaid adapter imports Mermaid (an optional peer) only when a Mermaid diagram is shown, and it falls back to the source text with an error if Mermaid cannot load.

  New package `@link-foundation/ui-components` with icons and an asset pipeline:
  - 32 public-domain (CC0-1.0) icons of our own, drawn on a 24×24 grid with a 2 px stroke in `currentColor`, each with a record in `assets/assets.lino`.
  - An icon registry (`registerIconSet`, `resolveIcon`, `iconRecords`): a name falls back to the own set and then to a placeholder.
  - The `ui-icon` element and the `icon` kind for ui-dom, `(icon close)` or `(icon (set lucide) (name check) (label 'Done'))`. An icon is decorative by default and becomes an image named by its label. Direction icons mirror in right-to-left text.
  - Adapters for Lucide, Tabler and Material Symbols. These are optional peer dependencies, and every icon carries a licence record.
  - `scripts/build-icons.mjs` builds each set into a module and a sprite with SVGO and `currentColor`, and writes `NOTICE.lino`, `ATTRIBUTION.md` and the licence files. The build fails on an icon without a record, on a licence that is not allowed, and on Remix Icon or SF Symbols.

  Add the layout and windowing kinds of ui-dom to `@link-foundation/ui-components` (entry points `./layout` and `./layout.css`, also exported from the package root): `stack` and `grid` (thin wrappers of flexbox and grid with checked track lists), `split` (WAI-ARIA window splitter, min/max/collapsible panes, sizes remembered as Links Notation), `tab-group` (WAI-ARIA tabs with close, reorder, drag and overflow menu), `dock` (regions, move, float, close and restore panels, layout saved and read back as Links Notation), `window` (movable, resizable, kept inside the viewport) and `app-shell` (bottom bar, rail or drawer by breakpoints). A layer manager orders every floating surface so a raised window never covers a modal; `layout.css` styles them all.

  Add `@link-foundation/ui-components` with `link-view`, a single link visualisation ported from links-visuals:
  - link geometry: nine points through a Catmull-Rom path, self-loops and free ends;
  - `bar`, `arrow`, `cross`, `dot` and `none` markers, kept as data and shared by the SVG and Canvas renderers;
  - `createZoomPan` (0.1 to 20, `0.999 ** delta`, pointer capture), separate for each element;
  - an animator that asks for no frame while idle and respects reduced motion;
  - a `link-view` custom element that reads Links Notation through the official parser, with `blueprint` and `grid` modes, `+`, `-` and `0` keys, and an accessible name;
  - a gallery page.

  Add `@link-foundation/ui-config`: every property of a UI document resolved through the layers defaults < theme < site < user < session, with the layer that won (`resolve`, `explain`). User and session overrides are edited with `set`/`unset`, and any layer is loaded, imported and exported as a Links Notation `overrides` patch (`readPatch`, `writePatch`, diff-only `exportPatch`, with 64 KiB / 2,000-op limits and diagnostics). `describeChanges` explains overrides in plain English, `persistLayer` keeps the user and session layers in Web Storage, and `bindStore` applies every change to a ui-store store as one transaction with the origin `config`.

  Add `@link-foundation/ui-convert` with the HTML/DOM importer: `importHtml(text)` and `importDom(root)` turn HTML text or a live DOM subtree into a `ui-dialect/0` Links Notation document with deterministic unique ids, source spans, a `nodeMap` back to the DOM nodes, a data mapping table with a lossless `html` fallback, inline styles as `(style ...)` links, and dropped scripts, event handlers and `javascript:` URLs reported as `dropped-script` diagnostics.

  Add the `@link-foundation/ui-convert` package with import and export pairs for A2UI 0.9.1 (`importA2ui`, `exportA2ui`, `a2uiMessagesToDiffs`, `A2uiStream`), Adaptive Cards 1.6 (`importAdaptiveCard`, `exportAdaptiveCard` with `targetVersion` fallbacks, `hostConfigToTheme`), JSON Forms 3 (`importJsonForms`, `exportJsonForms`) and Lottie 1.0 (`importLottie`, `exportLottie`), plus `detectFormat` and the `ui-convert import|export` command line. Unknown properties survive a round trip in `(extra <format> '<json>')`, every lossy step reports a diagnostic, and expressions, templates and scripts are never evaluated.

  Add the JSX / TSX and Vue single-file component importers: `importJsx(text, { mappings })` and `importVue(text, options)` turn React / MUI markup and Vue SFCs into `ui-dialect/0` Links Notation with spans, applied rule names and `{ code, message, span }` diagnostics for every unsupported construct. Components are mapped by a LiNo match / replace rule engine (`applyRules`, `readRules`) with built-in MUI rules (`src/mappings/mui.lino`); unmatched components fall back to `(html (tag X))`. Vue `v-if` / `v-else`, `v-for`, `@click`, `:prop` and `v-model` become `when`, `each`, actions and binds. The CLI gains `ui-convert import --from jsx|vue <file>` and `--mapping`.

  Add deterministic React and Vue wrapper/eject exports, SwiftUI and Compose source exports, and the `ui-convert export --target` CLI with diagnostics for unsupported constructs.

  Add `parse`, `parseOrThrow`, `toTree`, `format` and `walk`: `ui-core` now reads `ui-dialect/0` Links Notation into the UI element tree, gives the same tree for the one-line, multi-line and indented forms, reports problems as spec diagnostics, writes the tree back as text, and passes all 50 conformance fixtures of `docs/spec/fixtures/`.

  Add `@link-foundation/ui-core/source`: edit a LiNo document in place and keep its comments and layout. `indexSource` maps every element, property and value to its span, each span checked against the `links-notation` parser; `setProp`, `removeProp`, `setPositional`, `insertChild`, `removeNode`, `moveNode`, `renameId` and `applyOpsToSource` change only the bytes they must and check the result against the expected tree. Declare `note` as a property of every kind in `ui-dialect/0`.

  Add the typed value layer `values`: schema-driven typing of dimensions, durations, numbers, colours (quoted hex, `(rgb …)`, `(oklch …)`), enums, URLs, element references, actions, `(token …)`, `(param …)` and `(or …)` fallbacks with `invalid-value` and `reserved-sigil` diagnostics, lexical inference for untyped values, canonical Links Notation and CSS output, and oklch ⇄ sRGB conversion with `toHex`.

  Introduce the `@link-foundation/ui-core` workspace package, which exports `UI_DIALECT_VERSION`. The repository root is now a private npm workspaces monorepo.

  Add `@link-foundation/ui-devmode`: the development/configuration mode inspector. `mountDevMode({ root, config, policy })` installs the entry points the site policy allows: `Alt+Shift+D` (by `event.code`, ignored in text fields), `?ui-dev` and `<ui-dev-mode>`. It loads the overlay and inspector with a dynamic `import()` only when dev mode opens, and never with `(enabled false)`. The overlay labels and selects elements without delivering the click to the app. The inspector, docked right in a shadow root, has Outline (WAI-ARIA tree), Properties (typed editors with the winning layer and reset), Styles, Tokens, Animations and Source tabs. Edits write the session layer, Save moves them to the persisted user layer, and Discard and Reset are supported. Locked elements stay read-only, and `globalThis.linkUiDevMode` exists while dev mode is open.

  Add the `ui-dialect/0` specification in `docs/spec/` (element model, tree projection, values, ordering and ids, behaviour, limits, open questions, vocabulary and JSON Schema) with 50 conformance fixtures, the `npm run check:spec` checker and its test.

  Add `@link-foundation/ui-dom`, the reference DOM renderer: a ui-store document renders as plain custom elements in the light DOM (`ui-document`, `ui-stack`, `ui-text`, `ui-button`, `ui-image`, `ui-unknown`) with stable `data-link-id` attributes, incremental patches batched into one microtask, `(on press ...)` handlers dispatched as bubbling `ui-action` events without running code, ui-style and ui-tokens CSS adopted once per root, a kind registry (`defineKind`), `renderToHTML` for static HTML, and an example page with a Playwright check.

  Add `@link-foundation/ui-i18n`: localisation with lino-i18n 0.5.0. Documents refer to catalog messages with `(t KEY (PARAM VALUE) ...)`; `createLocalizer({ config, catalogs, approved, defaultLocale })` reads the root prop `locale` through the ui-config layers (falling back to `determineLocale(navigator.languages, approved)`, then `en`), resolves text with interpolation, CLDR plurals, fallbacks and `onMissing`, gives the direction from `getLocaleDirection` and `localizeDocument` writes `(lang ...)` and `(dir ...)` on the root. `locales/ui.lino` holds the framework messages in en, ru, zh and hi, and `npm run check:i18n` checks key parity with `lino-i18n check` and reports hard-coded text in documents with `(i18n required)`.

  Add `packages/ui-kotlin/`, the Jetpack Compose / Compose Multiplatform renderer of `ui-dialect/0` (desktop target, optional Android target): `UiView` draws `document`, `stack`, `text`, `button` and `image` with Material 3, uses the generated ui-tokens Kotlin output as its default theme and reads theme `.lino` files at run time, sends `(on ...)` actions to the host as `UiAction` data (rejecting `javascript:`, `data:` and `vbscript:` targets), tags every element with its id, and has LiNo render-tree snapshots for the shared fixtures. Also adds the desktop example in `examples/kotlin/` and the ui-kotlin CI jobs.

  Add createLinksNames to store Unicode names as doublets in the data storage.
  Record names atomically with queries, enforce permissions on their encoding,
  and load and push name links to partial synced clients.

  Add `@link-foundation/ui-links`: associative links storages behind one doublets interface (memory, SQLite, doublets-web, and IndexedDB, `localStorage` or Links Notation text through persistence adapters), link-cli's substitution queries on any of them, types (`Type -> SubType -> … -> Value`, multiple inheritance) and permissions stored as links, a links server speaking the `clink --serve` protocol with authentication and subscriptions (in process and over TCP), and a synced client that keeps the part of the links its user may read, writes optimistically and sends the writes in order.

  ui-store: add `writeDocumentLinks(encoded, links, names?)` and `readDocumentLinks(links, { names, roots })`: the doublets of a UI document in any storage with the doublets interface (the `@link-foundation/ui-links` storages, or a synced client of a links server), next to other data, read back from the links reachable from its roots.

  ui-store: add the `setPositional` store operation: `store.setPositional(id, values)` (and `{ op: 'setPositional', id, values }`) sets the positional values (atoms) of one element as one `update` event without `prop`, undoes with the old values and is written to the log as `(setPositional id values…)`. ui-config `bindStore` uses it instead of removing and inserting the element again, and `set`/patches reject a link among positional values with `bad-value`.

  Add per-object UI comments with picking, freehand lasso and keyboard selection,
  text or opt-in voice instructions, anchored tasks, and validated versioned LiNo
  exchange, persistence and event history. Share the workflow across the runtime
  inspector, foreign pages and WYSIWYG designer.

  Add `@link-foundation/ui-react`, the React adapter: `<UiView>` mounts the ui-dom renderer once and store changes patch the DOM without re-rendering it; `<UiProvider>` and the DOM-free `@link-foundation/ui-react/hooks` entry (`useUiStore`, `useUiElement`, `useUiProp`, `useUiProps`, `useUiAction`) read the store through `useSyncExternalStore`; document actions call `actions` handlers and `onAction`; custom kinds can be React components rendered through portals; `ssr` inlines the escaped static HTML, and an example Vite app shows a counter and a React-rendered chart.

  Isolate the production action-warning test environment so parallel Deno workers cannot load empty React scheduler exports.

  Add `@link-foundation/ui-settings`: a settings schema written in Links Notation (`readSchema`, with diagnostics) gives coercion of the field types `range`, `number`, `toggle`, `choice`, `color`, `text` and custom types (`defineFieldType`), untrusted merging that never throws, diff-only values documents `(settings (version 2) (liquid.blur 24))`, presets (`applyPreset`, `activePreset`), seeded randomised looks with locked keys and comfort settings, versioned migrations, `#settings=` share links (8 KiB limit) with readers for the JSON links of immortality (`#ui=`) and konard.github.io, `applyToRoot`, a before-paint script with its CSP hash, the `assertEverySettingUsed` test helper and `bindConfig` to keep values in the `user` layer of ui-config.

  Add `@link-foundation/ui-store`: a UI document as a mutable links network with stable IDs, change events, nested transactions, undo/redo and an ordered operation log that is written and read as Links Notation (`logToLino`, `logFromLino`) and can be replayed. ui-core gains `parseLinks(text)` and `formatLinks(values)`, which read and write Links Notation as raw values (atoms, links and `{ id, values }`) through `links-notation`, without the element projection, so formats such as the ui-store operation log need no parser of their own.

  Add IndexedDB persistence: `openPersistentStore({ name, indexedDB?, initialText?, channel? })` returns a store saved to the database `link-ui-<name>` as a doublets table (`encodeDocument` / `decodeDocument`, compatible with `doublets-web`) plus a write-through Links Notation operation log, with `flush`, `compact`, `.lino` bundle export/import (checked against ui-core size and depth limits, replaced in one transaction), `reload`, `close`, `destroy` and `BroadcastChannel` reloads across tabs. `copyToDoubletsWeb(encoded, unitedLinks)` copies the doublets into a `doublets-web` `UnitedLinks` (optional peer dependency, loaded only by `openDoubletsWeb()`). `createStore` gains the `ids` option.

  Add `@link-foundation/ui-style`: style rules written in Links Notation (`(NAME: style (selector (type KIND) (id ID) (PROP VALUE) (within ...)) (PROPERTY VALUE) (state hover ...) (media (max-width 640px) ...) (container (min-width 400px) ...))`) with nested blocks, the states hover, focus, pressed, disabled, selected and checked, and the conditions min-width, max-width, prefers-color-scheme and prefers-reduced-motion. `readStyles` reports CSS syntax in bare values (`(state :hover)`, `(media (max-width: 640px))`) as a `css-syntax` diagnostic and types every declaration with ui-core typed values. `compileCss` writes the stylesheet of the DOM renderer (`ui-button[variant='filled']:hover`, token references as `var(--color-primary)`, escaped identifiers and quoted attribute values, never `url(`). `resolveStyle` gives the resolved style of one element in a state and environment, with the id of the winning rule per property, using the CSS cascade (specificity, then source order).

  Add `ui-swift`, the SwiftUI renderer (`packages/ui-swift`, root `Package.swift`): `UiSwiftCore` (Foundation only: the spec projection, themes with the F11 default, `(on …)` actions and a platform-neutral render tree with LiNo snapshots of the spec fixtures), `UiSwiftUI` (`UiView(document:theme:onAction:)` over a per-element `@Observable` model) and the `UiDemo` macOS app, with Linux and macOS CI jobs.

  Add the shared Playwright Test and axe-core setup for visual regression and WCAG 2.2 A/AA tests. The tools are dev/CI only; the published package code is unchanged.

  Add `@link-foundation/ui-tokens`: design tokens written in Links Notation (`(token PATH VALUE (type T) (description '...'))`, aliases `(token a (token b))`, `(extends base)` and `(mode dark ...)`) for the DTCG 2025.10 types color, dimension, duration, number, fontFamily, fontWeight, cubicBezier, shadow and typography. `readTokens` and `resolveTokens` report problems as diagnostics (`unknown-alias`, `alias-cycle`, `type-mismatch`, ...). `toCss`, `toDtcg` (Color Module colours, modes in `$extensions`), `toSwift` and `toKotlin` write the tokens, `fromDtcg` reads a DTCG file back losslessly, and `@link-foundation/ui-tokens/style-dictionary` runs Style Dictionary, an optional peer dependency, for other platforms. The `link-ui-tokens build` CLI writes the CSS, DTCG, Swift and Kotlin files.

  Add `@link-foundation/ui-vue`, the Vue 3 adapter of the ui-dom renderer: a `UiView` component (`source`, `store`, `actions`, `components`, `ssr` and `options` props, and an `action` emit) whose render function never re-runs for store changes, `createUiPlugin({ store, actions })` providing the store and an action registry under the `UI_STORE_KEY` and `UI_ACTIONS_KEY` symbols, the composables `useUiStore`, `useUiElement`, `useUiProp` and `useUiAction` returning read-only shallow refs that unsubscribe on scope dispose, Vue components for custom kinds rendered through `Teleport` into ui-dom hosts, `isUiCustomElement` for the Vue compiler, server rendering without `window` (the `ssr` prop inlines `renderToHTML`), type declarations, and a Vite + Vue example app.

  Expose viewer-owned comfort targets through configuration registration and queries.
  Register settings schema comfort fields when binding, and retain those targets in
  shared look imports and dev mode previews while allowing intentional user edits.

  Split the Windows Bun CI suite into three independent file shards to keep process-heavy fixture tests within the existing execution budget. Isolate Bun test files so sorted discovery cannot leak DOM globals or cached framework runtimes between files. Keep preflight status fixtures to one package and verify workspace enumeration separately to avoid repeatedly probing all real workspaces. Published package code is unchanged.

  Keep Windows Deno verification within its suite budget using independent file shards and bounded release-preflight fixtures.

  Keep the Windows Deno release formatter fixture from writing Node's compile cache and npm log files during its nested `npx prettier` run, and trace event-loop stalls in it, without changing release packages.

  Trace and verify Windows Deno release formatter process completion without changing release packages.

### Patch Changes

- Updated dependencies
  - @link-foundation/ui-core@0.1.0
  - @link-foundation/ui-dom@0.1.0
  - @link-foundation/ui-settings@0.1.0
  - @link-foundation/ui-style@0.1.0
  - @link-foundation/ui-tokens@0.1.0
