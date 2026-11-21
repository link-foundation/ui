# Network editor adapters

`createNetworkEditor(root, { presentation })` mounts native, labelled DOM panels
for a prepared `createNetworkPresentation` instance. It returns `snapshot()`,
`updateLinks(links)`, `updateOptions(patch)`, `restoreUrl()`, `ready`, and
`dispose()`. The presentation stays host-owned. The browser example is
[`examples/network-editor.html`](examples/network-editor.html).

```js
import {
  createNetworkEditor,
  createNetworkEditorProvider,
  createNetworkPresentation,
} from '@link-foundation/ui-components/links-view';

const presentation = createNetworkPresentation(createNetworkEditorProvider());
await presentation.update({
  items: [
    [1, 1],
    [2, 2],
    [1, 2],
  ],
});
const editor = createNetworkEditor(document.getElementById('editor'), {
  presentation,
  locale: 'en',
  solve: (links, options, context) => solverJob(links, options, context),
});
```

The adapter uses the pure model, notations and canonical renaming available at
`@link-foundation/ui-components/links-view/configurations`. A host may supply
another `configurations` object implementing that module's contract.

## Host panels and messages

Supply `mounts` to place individual panels in host-owned HTML. Fields remain
labelled and URL synchronization listens to every mounted panel.

```js
const editor = createNetworkEditor(editorRoot, {
  presentation,
  mounts: {
    notations: notationSection,
    links: linkSection,
    styles: styleSection,
    actions: actionSection,
  },
  messages: {
    share: 'Compartir',
    done: 'Listo',
    'download.jpg': 'Guardar JPEG',
    'target.Mastodon': 'En el fediverso',
  },
});
```

Use `networkEditorMessages` to inspect available keys and interpolation values.
Overrides can replace action names, statuses, errors and control labels.
The `error` template receives `{detail}` from the underlying error.
Notation validation uses `notationError.<code>` overrides and the configured
notation locale. Disposing the editor removes the panels it mounted.

For custom controls, `createNetworkEditorModel(presentation, { onChange, onBusy })`
exposes the same state and actions without requiring a DOM. Use `snapshot()`
to read editable state, `applyLinks` and `changeOptions` to edit, or `applyStyle`
to replace a look. It also exposes `removeLink`, `canonicalize`, `restore`,
`solve` and `dispose`. Subscribe to the presentation directly for updates to
committed artwork.

## Options and provider boundary

`networkOptionSchema` describes each scalar renderer/solver field with its
key, type, bounds, step, default, section and availability rule.
`networkOverrideSchema` describes per-link turns, gaps, colours, pinned frames
and circle order. `networkOptionAvailable(field, links, options)` evaluates
availability against the current network and options.

`normalizeNetworkOptions` returns a detached, clamped object. Fields use dotted
names for groups, such as `start.shape`, `background.color` and `caption.mode`.
`turns` and `linkGaps` are arrays in link order; `linkColors` inherits when null.
Empty per-link gap inputs mean null/inherit. `frame` is `[scale, x, y]`, with
finite coordinates bounded by ±1e6 and scale in `(1e-9, 60]`. `order` is a
permutation of the current IDs. Scalar defaults match the specifications in
issues #227 and #228; passes are bounded to 1..10 for an interactive editor.

`networkOptionsToParams` writes only nondefaults. Structured values use LiNo.
`networkOptionsFromParams` reads legacy flat field names including `placement`,
marker fields such as `endSize`, `colors`, comma-separated `turns` and `gaps`,
background, card and caption fields, and the shared `gap`. Options written
with canonical names take precedence over their aliases. Legacy custom
colours override entries in the original site palette. Flat turn lists and
rotations above 180° also identify legacy bookmarks. Bookmarks with only
shared keys, such as `code` and `width`, can be read with `{ legacy: true }`
to select legacy defaults explicitly.

In canonical state, setting a base colour without selecting a palette uses
the custom palette. Selecting the default palette restores scalar colours and
keeps per-link overrides and the pinned frame. The URL's `code` is separate
from the options. Call `restoreUrl()` on initial mount when the host has
yet to prepare the presentation from the URL. Back/forward events restore
automatically.

`networkOptionsToLino` / `networkOptionsFromLino` are the editor's canonical
flat-key LiNo state. They are suitable for presentation providers built for this
vocabulary. An existing provider with another LiNo vocabulary must supply both
`serializeOptions(options)` and `readOptions(text)`. The presentation bridge
intentionally keeps provider text opaque. Renderer options, solver inputs and
per-link colours are not silently injected into another provider's grammar.

`createNetworkEditorProvider()` adapts the built-in doublet renderer to this
persisted vocabulary. It translates groups, global gaps, per-link turns/gaps,
colours, frames and circle order into nested LiNo. Default marker fields stay
implicit so tip compensation is preserved. Per-link colours are resolved on the
fitted frame so preview, raster and `doubletToSvg` all use the same artwork.

The collision algorithm in #228 remains independent upstream work. Hosts supply
a solver callback; the editor does not substitute an algorithm or simulated
collision counts when none is installed.

## Editing and styles

The five notation fields update on valid input. Invalid drafts retain the
localized English/Russian error and leave the presentation unchanged. Draft text
survives option edits; a network change elsewhere replaces it. The single-line
links field uses the official formatter's inline mode. Downloads use nested
LiNo with one link per line.

The [configurations API guide](CONFIGURATIONS.md) lists the historic editor
inputs and validation parameters for hosts building localized field errors.

Reference menus switch to bounded integer inputs above 50 links. Removal uses
the configurations index map for turns, gaps and colours. Canonical renaming
also remaps these overrides and is disabled above 7 links. Previous/next walk
counting order across sizes. Random actions use the exact-integer configuration
module, with a real-only variant.

A geometry edit clears `frame`; colours retain it. Link-count changes also
clear circle order. Section reset buttons disable when their scalar values are
defaults. Looks replace renderer style while preserving notation, per-link
turns/colours/gaps, global gaps and solver settings. Size presets cover all seven
specified dimensions. Named styles are LiNo documents in local storage key
`links-network-editor-styles`; loading applies the same preservation rules.
Storage errors appear in the live error region.

## Solver jobs and sharing

The optional `solve(links, options, {signal})` callback returns
`{turns, linkGaps, frame, before, after, delta?}`. The Apply action reports busy,
errors and collision counts, and commits only turns, gaps and frame. Editing
aborts the callback and discards stale results. Disposal aborts outstanding work.
The UI's contract tests use controlled callback results to test these boundaries;
they do not claim to verify a collision algorithm.

Downloads and copy actions use the committed presentation. The raster exports
use the configured dimensions and quality, and JPEG uses `background.color`
as its matte. SVG uses the prepared geometry. Filenames are sanitized and capped at 160 characters.
The image ClipboardItem is constructed synchronously inside the click, holding
a promise for the PNG. Web Share prepares PNG after a 200 ms debounce and drops
stale preparation. Unsupported file sharing falls back to the URL. Share target
links come from `networkShareDestinations`, an id-to-label-and-template map.
Use `networkShareTargets(url, title, { mastodonInstance, emailBody })` to expand
those templates in a custom UI, or pass the same options in the editor's
`share` settings. An instance may be a hostname or an HTTPS origin.
`emailBody` accepts `{title}` and `{url}` and defaults to both on separate lines.
Supply `destinations` to replace the map. A destination template can use
`{url}`, `{title}` and `{emailBody}` as individually URL-encoded values and
`{mastodonOrigin}` as an HTTPS origin. Results use `aria-live`.

`syncNetworkUrl(presentation, {urlFor, ...})` is independently usable. It calls
`replaceState` only when the committed URL changes, debounced by 400 ms.
The editor preserves unknown query parameters and history state.
Pointer, touch and slider-key holds defer writes until release. Keyboard holds
end on focus loss, including when the held control is removed. Failures, including
SecurityError, retry at 1, 2, 4 and 8 seconds, stopping after five failures.
New committed state starts a fresh attempt. Timers can be injected for tests;
`debug(message, details)` is silent unless supplied. `dispose()` unsubscribes,
removes listeners and cancels timers. Pass `syncUrl: false` to the editor to let
the host manage URL synchronization.

## Verification

- `node --test packages/ui-components/tests/links-view/network-editor*.test.js`
- `node --test packages/ui-components/tests/links-view/configurations.test.js`
- `npx playwright test packages/ui-components/tests/e2e/network-editor.spec.js --workers=1`

The browser suite checks notation editing, a real 2-second slider hold, pinned
frame URLs, byte-identical PNG/JPEG/WebP downloads where the browser supports
encoding, JPEG matte pixels, one-link-per-line LiNo, clipboard user activation,
host-mounted panels, accessibility and notation-panel visual baselines.
The example intentionally leaves Apply disabled without a real solver callback.
