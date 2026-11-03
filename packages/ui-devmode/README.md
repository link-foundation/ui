# @link-foundation/ui-devmode

The development/configuration mode of the framework: a runtime inspector over
any page rendered by [`@link-foundation/ui-dom`](../ui-dom/README.md). You
hover, select, inspect and edit every element of the page. Edits go only to the
`session` and `user` layers of
[`@link-foundation/ui-config`](../ui-config/README.md), never to the site
document.

![The inspector with the ok button selected](../../docs/screenshots/ui-devmode-inspector.png)

```js
import { parse } from '@link-foundation/ui-core';
import { mountDocument } from '@link-foundation/ui-dom';
import {
  createConfig,
  persistSessionLayer,
  persistUserLayer,
} from '@link-foundation/ui-config';
import { mountDevMode } from '@link-foundation/ui-devmode';

const root = document.getElementById('app');
const { store, handle } = mountDocument(root, text, { styles, tokens });

const config = createConfig({ document: parse(text) });
persistUserLayer(config); // restores and keeps the saved edits
persistSessionLayer(config); // keeps the unsaved edits of this tab
config.bindStore(store); // the page follows the resolved configuration

mountDevMode({
  root,
  config,
  store,
  handle,
  styles,
  tokens,
  animations,
  policy: `(site-dev-mode: dev-mode
  (enabled true)
  (entry shortcut url-parameter element)
  (shortcut 'Alt+Shift+D')
  (write-layers session user)
  (locked-elements payment-form))`,
});
```

`mountDevMode` itself is small: it reads the policy and installs the entry
points. The overlay, the inspector and the model are loaded with a dynamic
`import()` the first time dev mode opens. With `(enabled false)` they are never
requested.

## Opening dev mode

| Entry point     | How                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `shortcut`      | `Alt+Shift+D` (matched on `event.code`, so it works on every layout) toggles dev mode; ignored while typing in a field |
| `url-parameter` | `?ui-dev` opens dev mode on load (`?ui-dev=false`, `0`, `off`, `no` do not)                                            |
| `element`       | a `<ui-dev-mode></ui-dev-mode>` element in the page opens dev mode                                                     |

## The site policy

The policy is a `dev-mode` link, read with ui-core `parse` (the official
Links Notation parser):

| Property          | Default                          | Meaning                                                                |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `enabled`         | `true`                           | `false` turns dev mode off: no entry point, no inspector module loaded |
| `entry`           | `shortcut url-parameter element` | the entry points that may open dev mode                                |
| `shortcut`        | `'Alt+Shift+D'`                  | the key combination                                                    |
| `write-layers`    | `session user`                   | the layers an edit may write; `user` is needed to Save                 |
| `locked-elements` | none                             | element ids that stay read-only, with their descendants                |

Unknown keys, entry points, layers and values are reported in
`policy.warnings` and ignored. `defaults`, `theme` and `site` are never
writable.

## The overlay

While dev mode is open, the element under the pointer is outlined and labelled
`id: type` (for example `ok: button`). A click selects it and is not delivered
to the app. Escape leaves pick mode, so the page works as usual again. A second
Escape closes dev mode. The boxes come from `getBoundingClientRect`, have
`pointer-events: none`, and have no transitions under
`prefers-reduced-motion: reduce`.

## The inspector

The inspector is docked to the right of the page inside a shadow root. It is
resizable with the pointer or the arrow keys on its WAI-ARIA window splitter.
Its layout is [`src/inspector.lino`](src/inspector.lino), rendered by ui-dom.
It follows `prefers-color-scheme`, and its texts come from a message table
(`messages` option) that pages can translate.

| Tab        | Content                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Outline    | a WAI-ARIA tree of the elements (`app > body > greeting, ok`); selecting a row selects the element                              |
| Properties | a grid `name, editor, resolved value, layer, reset`; changed rows (user or session layer) are marked; locked rows are read-only |
| Styles     | the style rules that match the selected element                                                                                 |
| Tokens     | the tokens the element uses, with their resolved values                                                                         |
| Animations | the animations that target the element                                                                                          |
| Source     | the Links Notation of the element                                                                                               |

The property editors are typed: text, number, boolean (a checkbox switch), enum
(select), colour, dimension (number and unit), token reference and read-only
values (actions).

| Action  | Effect                                                              |
| ------- | ------------------------------------------------------------------- |
| edit    | writes the `session` layer; the page updates at once                |
| Save    | moves the session overrides to the `user` layer, which is persisted |
| Discard | clears the `session` layer                                          |
| Reset   | removes the value from the highest writable layer that holds it     |

## Automation

While dev mode is open, `globalThis.linkUiDevMode` is
`{ select(id), getSelection(), setProperty(id, name, value), close() }`.
`setProperty` writes the session layer and throws a `DevModeError` (with a
`code`) for a locked element or a bad value. The handle is removed when dev
mode closes.

The pure model is exported as `@link-foundation/ui-devmode/model`
(`buildOutline`, `propertyRows`, `applyEdit`, `resetProperty`,
`saveSession`, `discardSession`). `applyEdit` throws for the `site`, `theme`
and `defaults` layers and for locked elements.

## Example

`examples/index.html` renders `docs/case-studies/issue-1/samples/document.lino`
with dev mode. Run `node scripts/serve-static.mjs` and open
`http://127.0.0.1:4173/packages/ui-devmode/examples/?ui-dev`. Add
`&policy=disabled` for a disabled policy, or `&lock=ok` to lock an element.

## Tests

- `tests/*.test.js` (`npm test`) cover the policy, the activation, the model,
  and the whole inspector in jsdom.
- `e2e/devmode.e2e.mjs` (`npm run test:ui`) covers the acceptance flow in
  Chromium and WebKit: entry points, the lazy loading under a disabled policy,
  pick mode, the outline, the edit, save, reload and reset flow, locked
  elements, and axe.

## License

[Unlicense](LICENSE)
