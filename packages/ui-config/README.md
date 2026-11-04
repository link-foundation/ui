# @link-foundation/ui-config

Every property of a [`@link-foundation/ui-core`](../ui-core/README.md)
document resolved through five configuration layers, with the layer that won.
User and session overrides are edited here, and any layer is read and written
as a Links Notation `overrides` patch: the format the dev mode hands to an AI
agent with "make these the defaults" (`docs/ARCHITECTURE.md`).

```js
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import {
  createConfig,
  describeChanges,
  persistUserLayer,
} from '@link-foundation/ui-config';

const document = parse(`(app: document
  (greeting: text 'Hello, links')
  (material3: theme (token color.primary '#6750A4')))`);
const config = createConfig({ document });

config.set('user', 'greeting', 'text', ['Hello, agents']);
config.set('user', 'material3', 'token', ['#00639B'], 'color.primary');

config.resolve('greeting', 'text');
// { layer: 'user', value: ['Hello, agents'] }
config.explain('greeting', 'text');
// [{ layer: 'site', value: ['Hello, links'] }, { layer: 'user', value: ['Hello, agents'] }]

console.log(config.exportPatch());
// (user-overrides: overrides
//   (layer user)
//   (base app)
//   (set greeting text 'Hello, agents')
//   (set material3 token color.primary '#00639B'))

describeChanges(config);
// [ "greeting: text changed from 'Hello, links' (site) to 'Hello, agents' (user)",
//   "material3: token color.primary changed from '#6750A4' (site) to '#00639B' (user)" ]

persistUserLayer(config); // localStorage, key link-ui.config.user.v1
config.bindStore(createStore({ document })); // one transaction per change
```

The complete example is `examples/ui-config-basics.mjs` in the repository.

## Layers

A value is looked up from the top layer down; the first layer that has one
wins.

| Layer      | Holds                                                                    | Changed by                                  |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| `session`  | Temporary overrides of the dev mode, not saved yet.                      | `set`, `unset`, `importPatch`, `loadLayer`  |
| `user`     | Overrides the user saved in the browser.                                 | `set`, `unset`, `importPatch`, `loadLayer`  |
| `site`     | The committed configuration: **the base document itself**, plus a patch. | `loadLayer` (the document is never changed) |
| `theme`    | The active theme's values.                                               | `loadLayer`                                 |
| `defaults` | The components' own defaults.                                            | `loadLayer`                                 |

`clear(layer)` empties the patch of any layer. The values written in the base
document count as the `site` layer, so a `site` patch overrides them and
`explain` reports them as `site`. ui-core has no per-component default values
yet, so `defaults` and `theme` start empty and are filled from patches
(`loadLayer` or `createConfig({ layers })`).

## Properties, keys and values

`set(layer, id, name, values, key?)` names a property of the element `id`:

- if `name` is the element's kind (`text` of `(greeting: text 'Hello')`), the
  values replace its positional values, which are atoms only (a link throws
  `bad-value`, and is a `bad-value` error diagnostic in a patch);
- if `name` is a keyed prop (`token` and `state` by default, see
  `keyedProps`), `key` selects the one prop with that first value:
  `set('user', 'material3', 'token', ['#00639B'], 'color.primary')` changes
  only `(token color.primary …)`;
- otherwise the values replace the prop (the last one with that name).

Values are ui-core raw values: atoms (`'16px'`) and links (`['token',
'space.large']` for `(token space.large)`).

## Viewer-owned comfort properties

Comfort metadata belongs to a config instance and identifies a whole target
(`id`, `name`, and, for keyed properties, `key`), independently of its layer.
The settings schema remains the source of policy: `bindConfig` from ui-settings
automatically calls `registerComfort` for every field marked `(comfort)` at
the bound target (default `settings`). This includes `sound.enabled` and
`sound.volume` when the sound settings schema is bound. No package-specific
names are built into ui-config.

```js
config.registerComfort('settings', 'sound.enabled');
config.registerComfort('settings', 'sound.volume');
config.isComfort('settings', 'sound.volume'); // true
config.comfortProperties(); // [{ id, name, key: null, mode: 'prop' }, …]
config.registerComfort('material3', 'token', 'motion.duration');

// Shared looks retain viewer-owned targets, including values in lower layers.
config.importLook(sharedPatchText, 'session');
// An intentional user edit is still permitted.
config.set('user', 'settings', 'sound.volume', ['0.2']);
```

`registerComfort(id, name, key?)` validates like `set`, is idempotent, and
lasts for the config's lifetime. Registration changes no values and emits no
change events. `isComfort` returns false for invalid or unregistered targets.
`comfortProperties()` returns a fresh array of immutable canonical targets in
registration order; keyed properties and positional values are supported.
Metadata is trusted application policy, not serialized into patches. Rebind
schemas or register policy when creating a fresh config.

For migration, replace `importPatch(text, layer?)` with
`importLook(text, layer?)` wherever the patch represents somebody else's look.
It validates the entire patch before applying anything, then skips both `set`
and `unset` of registered targets, applying other ops as one batch. The layer
defaults to the patch's declared editable layer, just as for `importPatch`.
It returns the same `{ ok, diagnostics }` result. A look containing only
comfort ops succeeds without changing values or emitting events. The dev mode
shared-preview consumer uses this path. Settings presets, shared values and
randomize continue to use the existing schema comfort policy.

`importPatch`, `set`, `unset`, `clear` and `loadLayer` continue to allow
intentional edits, resets and persistence restoration of comfort properties.
Do not use `loadLayer` to apply a shared look: it replaces a whole layer.

## Patch format

```
patch  = (NAME: overrides (layer LAYER) (base DOC) OP*)
OP     = (set ID NAME VALUE+)      | (set ID KEYED KEY VALUE+)
       | (unset ID NAME)           | (unset ID KEYED KEY)
LAYER  = defaults | theme | site | user | session
KEYED  = token | state             (the keyedProps)
```

- `(layer …)` is the layer the patch was written for; `(base …)` is the id of
  the document root it applies to. Both are optional when reading.
- Ops are applied in order; a later op on the same property wins. `unset`
  removes the override of that layer, so lower layers show through.
- `(note …)` is a comment and is ignored.
- Patches are read with `links-notation` through ui-core (never with regular
  expressions) and written with ui-core `format`, so they round-trip.

### Limits and diagnostics

`readPatch(text)` never throws. It returns `{ name, layer, base, ops,
diagnostics }`; a patch with an error diagnostic changes nothing when it is
loaded or imported, and no change event is sent.

| Code                                                                 | Severity | When                                                                 |
| -------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `patch-too-large`                                                    | error    | More than 64 KiB of UTF-8 (`DEFAULT_MAX_PATCH_SIZE`, `maxPatchSize`) |
| `too-many-ops`                                                       | error    | More than 2,000 ops (`DEFAULT_MAX_PATCH_OPS`, `maxPatchOps`)         |
| `not-a-patch`                                                        | error    | No `(name: overrides …)` link, or not text                           |
| `unknown-layer`, `unknown-op`                                        | error    | A layer or link the patch format does not have                       |
| `missing-id`, `missing-name`, `missing-key`, `missing-value`         | error    | An incomplete op                                                     |
| `unknown-id`                                                         | error    | The document has no element with that id (config only)               |
| `bad-value`                                                          | error    | A link among the positional values of an element (config only)       |
| `missing-layer`, `read-only-layer`                                   | error    | `importPatch` into no layer or into a layer below `user`             |
| `extra-links`, `unexpected-value`, `base-mismatch`, `layer-mismatch` | warning  | Ignored extra links or values; a patch for another document/layer    |

Parser errors of ui-core (`syntax`, …) are passed through.

## API

### `createConfig(options)`

| Option            | Meaning                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `document`        | The base document, as ui-core `parse` returns it. Its values are the `site` layer. |
| `layers`          | `{ [layer]: patchText }` loaded lowest first; an invalid patch throws `bad-patch`. |
| `keyedProps`      | Props whose first value is a key. Default `['token', 'state']`.                    |
| `base`            | The `(base …)` of exported patches. Default: the id of the first root.             |
| `maxPatchSize`    | Default 65,536 UTF-8 bytes.                                                        |
| `maxPatchOps`     | Default 2,000.                                                                     |
| `onListenerError` | `(error, events)`, called when a listener throws. Default `console.error`.         |

| Method                                   | Does                                                                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolve(id, name, key?)`                | `{ value, layer }` of the winning layer, or `undefined`.                                                                                                                   |
| `explain(id, name, key?)`                | Every layer that has a value, `[{ layer, value }]`, lowest first.                                                                                                          |
| `valueIn(layer, id, name, key?)`         | The value of one layer only.                                                                                                                                               |
| `set(layer, id, name, values, key?)`     | Write an override of `user` or `session`; other layers throw `ConfigError` `read-only-layer`.                                                                              |
| `unset(layer, id, name, key?)`           | Remove an override of `user` or `session`.                                                                                                                                 |
| `clear(layer)`                           | Remove every override of a layer.                                                                                                                                          |
| `loadLayer(layer, text)`                 | Replace a layer with a patch. Returns `{ ok, diagnostics }`.                                                                                                               |
| `importPatch(text, layer?)`              | Apply a patch on top of `user` or `session` (default: its `(layer …)`).                                                                                                    |
| `overrides(layer)`                       | The overrides of a layer, `[{ id, name, key, mode, values }]`.                                                                                                             |
| `effective()`                            | A copy of the base document with every resolved value written in.                                                                                                          |
| `exportPatch({ layers, against, name })` | The overrides of `layers` (default user and session) whose value differs from `against` (default `site`) as a patch. A user value equal to the site value is not exported. |
| `subscribe(listener)`                    | `listener(events)` gets every change of one call: `{ layer, id, name, key, mode, before, after }`. Returns an unsubscribe function.                                        |
| `bindStore(store, { origin, label })`    | Keep a ui-store store in step (below).                                                                                                                                     |

`set`, `unset`, `set` with an unknown id, a keyed prop without a key or values
that are not raw values throw a `ConfigError` with a `code`.

### `bindStore(config, store, options?)`

Writes the resolved value of every overridden property into the store now and
after each config change, as **one** store transaction with the origin
`config` (`CONFIG_ORIGIN`), so `store.undo()` undoes a whole config change.
When an override goes away the store gets the value of the next lower layer.
A change of positional values is one ui-store `setPositional` operation (one
`update` event without `prop`); IDs, properties and children are kept.
Returns a function that stops following the config.

### `describeChanges(config, layers?)`

One line per override of `layers` (default user and session) that changes
the value below them:

```
greeting: text changed from 'Hello, links' (site) to 'Hello, agents' (user)
body: padding set to 16px (user)
```

### `persistLayer(config, layer, storage, key?, { onDiagnostic })`

Restores `user` or `session` from a Web Storage object and writes the layer
back (diff-only against the layer below) after each change; an empty layer
removes the key. The default keys are versioned: `link-ui.config.user.v1` and
`link-ui.config.session.v1` (`STORAGE_KEYS`). Stored text that is not a valid
patch is ignored with an `invalid-stored-patch` diagnostic, and storage
errors become `storage-error` diagnostics: it never throws. Returns
`{ diagnostics, stop }`. `persistUserLayer(config)` and
`persistSessionLayer(config)` use `localStorage` and `sessionStorage`.

### `readPatch(text, options?)`, `writePatch(patch, formatOptions?)`

Read and write patches without a document. `writePatch({ name, layer, base,
ops })` writes ops of the shape `readPatch` returns.

## License

[Unlicense](LICENSE)
