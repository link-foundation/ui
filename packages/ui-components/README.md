# @link-foundation/ui-components

Behaviour for the associative UI framework, written in
[Links Notation](https://github.com/link-foundation/links-notation):

- **State machines in LiNo** (`./behavior`): `parseMachine` reads a
  machine and reports problems as diagnostics. `interpret` runs it. This
  entry point imports nothing from the DOM or from ui-dom, so it also runs
  in Node, in workers and in tests.
- **An actions registry** that never evaluates code. An action name maps to
  a host function, and an unknown name is a diagnostic. `navigate` rejects
  `javascript:`, `data:` and `vbscript:` URLs.
- **Reference machines**: `toggle` and `disclosure`.
- **ui-dom integration** (`./behavior/dom`): `mountBehavior` starts one
  machine service for each `(machine NAME ...)` element.
- **Accessibility helpers** (`./a11y`): focus trap and restoration, roving
  tabindex, typeahead, key bindings, a shared live region, and
  `bindMachine`.
- **Layout and windowing** (`./layout`, `./layout.css`): `stack`, `grid`,
  `split`, `tab-group`, `dock`, `window` and `app-shell` kinds for ui-dom,
  a layer manager, and dock layouts saved as Links Notation.

```sh
npm install @link-foundation/ui-components
```

| Entry point                                   | What it has                                                             | DOM |
| --------------------------------------------- | ----------------------------------------------------------------------- | --- |
| `@link-foundation/ui-components`              | everything below except `./behavior/dom`                                | yes |
| `@link-foundation/ui-components/behavior`     | `parseMachine`, `interpret`, `createActionRegistry`, ...                | no  |
| `@link-foundation/ui-components/behavior/dom` | `mountBehavior`, `BEHAVIOR_CSS`                                         | yes |
| `@link-foundation/ui-components/a11y`         | `trapFocus`, `createRovingTabindex`, `bindKeys`, ...                    | yes |
| `@link-foundation/ui-components/layout`       | the layout kinds, `createLayerManager`, `resizeSplit`, `movePanel`, ... | yes |
| `@link-foundation/ui-components/layout.css`   | the CSS of the layout kinds                                             |     |

## A machine in LiNo

```lino
(toggle-machine: machine
  (initial off)
  (context (pressed false) (disabled false))
  (action set-pressed (set pressed true))
  (action clear-pressed (set pressed false))
  (state off
    (on toggle (target on) (do set-pressed) (when not-disabled)))
  (state on
    (on toggle (target off) (do clear-pressed) (when not-disabled)))
  (part root
    (attr aria-pressed (context pressed))
    (key Enter toggle)
    (key Space toggle)
    (on press toggle)))
```

| Form                                               | Meaning                                                                                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(initial STATE)`                                  | the first state (required)                                                                                                                                                  |
| `(context (NAME VALUE) ...)`                       | the initial context. `true`, `false` and numbers are typed; other atoms stay text                                                                                           |
| `(state NAME ...)`                                 | a flat state                                                                                                                                                                |
| `(on EVENT (target S) (do ...) (when ...))`        | a transition. The first one whose guards all pass is taken. With no `target`, the state stays and no exit or entry runs                                                     |
| `(entry ACTION ...)`, `(exit ...)`                 | actions run when the state is entered or left                                                                                                                               |
| `(after 500ms (target S) ...)`                     | a delayed transition (`ms`, `s` or a plain number of milliseconds). It is cancelled when the state is left                                                                  |
| `(action NAME STEP ...)`                           | a named list of steps                                                                                                                                                       |
| `(set NAME VALUE)`, `(toggle NAME)`                | built-in steps that change the context                                                                                                                                      |
| `(part NAME (attr A V) (key K E) (on UI-EVENT E))` | the attributes of a part, the keys that send machine events (`Enter`, `Space`, `Shift+Tab`, `Ctrl+k`), and the UI events (`press`, `focus`, `blur`, `hover`) that send them |

Attribute values: `'text'`, `(context NAME)`, `(state)`, `(in S ...)`
(`true` or `false`), `(not V)`, and `(present V)`. `(present V)` makes a
boolean attribute such as `hidden` that is present only when `V` is
`true`. Attributes starting with `on` are never set.

Guards are names, never expressions. `not-disabled` is built in, and other
guards come from the `guards` option. An unknown guard, or a guard that
throws, blocks the transition and is reported.

### Diagnostics

`parseMachine(text)` returns `{ machine, diagnostics }`. A diagnostic is
`{ code, severity, message, at }`. The codes are:

- `missing-initial`, `unknown-initial`
- `duplicate-state`, `duplicate-action`
- `unknown-target`
- `invalid-delay`, `invalid-transition`, `invalid-action`
- `unknown-field` (a warning)

ui-core's parse diagnostics are also passed through. `createMachine(text)`
throws a `MachineError` that lists the errors.

## Running a machine without a DOM

```js
import {
  createManualClock,
  interpret,
  DISCLOSURE_MACHINE,
} from '@link-foundation/ui-components/behavior';

const clock = createManualClock(); // or globalThis (the default)
const service = interpret(DISCLOSURE_MACHINE, { clock });
service.subscribe(({ state, context }) => console.log(state, context));
service.send('toggle'); // closed → open
service.send('close'); // open → closing
clock.advance(500); // closing → closed
service.attrs('trigger'); // { 'aria-expanded': 'false', 'data-state': 'closed' }
service.stop(); // clears the timers and the subscribers
```

A `service` has:

- `state`, `context` and `status`
- `send(event)` and `can(event)`
- `subscribe(fn)`, which returns an unsubscribe function
- `assign(patch)`
- `use(effects)`
- `attrs(part)`
- `stop()`

Events sent from an action are queued and run after the current
transition. A loop that goes deeper than 32 steps stops with an
`action-error`.

## The actions registry

```js
import { createActionRegistry } from '@link-foundation/ui-components/behavior';

const registry = createActionRegistry({
  onUnknown: (d) => console.warn(d.message), // unknown-action
  host: { navigate: (url) => router.push(url) },
});
registry.register('save', (args, meta) => save(meta.source));
registry.dispatch('navigate', ['javascript:alert(1)']); // { ok: false, diagnostic: unsafe-url }
registry.dispatch('alert(1)'); // { ok: false, diagnostic: unknown-action }
```

The vocabulary actions have defaults that validate their arguments and
then call the `host` function of the same name:

- `navigate`
- `emit`
- `set`
- `toggle`
- `focus`

Handler text such as `(on press 'alert(1)')` is never run. It is an
`unknown-action` diagnostic. ESLint forbids `eval`, `new Function` and
string timers in `src/` (`no-eval`, `no-new-func`, `no-implied-eval`), and
a test checks that the rules stay on.

## In a ui-dom document

```js
import { mountBehavior } from '@link-foundation/ui-components/behavior/dom';

const behavior = mountBehavior(
  app,
  `(page: document
  (bold: button (label Bold) (machine toggle-machine))
  (more: button (label Details) (machine disclosure-machine (content panel)))
  (panel: stack (t: text 'Details')))`,
  {
    actions: { save: (args, meta) => save(meta.source) },
    host: { navigate: (url) => router.push(url) },
  }
);
behavior.serviceFor('bold').state; // 'off'
behavior.destroy();
```

`(machine NAME (PART ID) ...)` connects an element to a machine. Each
`(PART ID)` maps a machine part to another element, and every other part
is the element itself. Machines are looked up in this order:

1. the `machines` option
2. `machine` elements in the document
3. the reference machines (`referenceMachines: false` leaves them out)

Element properties that the machine context has, such as `disabled`, are
passed to the service.

`mountBehavior` takes every ui-dom `mountDocument` option. Handlers use
the same registry, so `(on press (save))` works once `save` is registered.
`BEHAVIOR_CSS` makes `[hidden]` parts hidden even on flex containers.

## Accessibility helpers

| Helper                                   | What it does                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `trapFocus(container)`                   | Tab and Shift+Tab cycle inside the container. It returns `release`, which restores the earlier focus |
| `createRovingTabindex(items)`            | one `tabindex="0"` item, moved with the arrow keys, Home and End                                     |
| `createTypeahead(getLabels)`             | typing letters moves to the first matching item                                                      |
| `bindKeys(element, { 'Shift+Tab': fn })` | key bindings. Typing in a text field never triggers a plain key                                      |
| `announce(message, { politeness })`      | shared `aria-live` regions (polite and assertive) for each document                                  |
| `bindMachine(root, service, parts)`      | applies the `attr` values of a machine to elements and binds its keys, UI events and `focus`         |

## Layout and windowing

`./layout` adds the layout kinds `stack`, `grid`, `split`, `tab-group`,
`dock`, `window` and `app-shell` to ui-dom. A layer manager orders every
floating surface, and a dock layout can be saved and read back as Links
Notation.

```js
import { mountDocument } from '@link-foundation/ui-dom';
import {
  createLayerManager,
  layoutVocabulary,
} from '@link-foundation/ui-components/layout';

mountDocument(app, text, {
  parseOptions: { vocabulary: layoutVocabulary() },
  layout: { storage: window.localStorage, layers: createLayerManager() },
});
```

```html
<link rel="stylesheet" href="@link-foundation/ui-components/layout.css" />
```

Importing `./layout` (or the package) registers the layout kinds with
ui-dom. The CSS gives
them their layout (dividers, tab strips, window frames, dock regions, shell
modes); every colour and size is a design token or a `--ui-*` custom
property with a fallback.

The gallery `examples/layout.html` (served with
`node scripts/serve-static.mjs`) shows every kind; its Playwright spec is
`tests/e2e/layout.spec.js`.

### Layout kinds

| Kind        | Example                                                                                        | What it does                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stack`     | `(stack (direction row) (gap 8px) (align center) (justify space-between) (wrap true) ...)`     | CSS flexbox. `direction` takes `vertical`, `horizontal`, `row`, `column` and their `-reverse` forms.                                                                                          |
| `grid`      | `(grid (columns 16rem 1fr) (rows auto 1fr) (areas 'nav main') ...)`                            | CSS grid. Tracks are lengths, `fr`, `auto`, `(repeat N ...)`, `(minmax MIN MAX)` and `(fit-content L)`; every token is checked. A child whose id names an area goes into it.                  |
| `split`     | `(split (sizes 30 70) (min 20) (collapsible true false) (remember-size chat.split) ...)`       | Panes with dividers (WAI-ARIA window splitter). Sizes are percentages with a constant total. `remember-size` keeps `(sizes 30 70)` in the render storage.                                     |
| `tab-group` | `(tab-group (label Inspector) (active styles) (styles: panel (title Styles) ...) ...)`         | Panels behind a tab strip (WAI-ARIA tabs, automatic activation). Tabs can be closed, reordered and dragged; a "More tabs" menu appears when they overflow.                                    |
| `panel`     | `(panel (title Styles) (closable true) ...)`                                                   | A titled panel: a tab of a tab group or a dock panel.                                                                                                                                         |
| `dock`      | `(dock (persist designer.layout) (left: region (size 16rem) (panels toolbox outline)) ...)`    | Panels docked left, right, top, bottom and center; each region shows its panels as tabs. A panel can move to another region, float, close and come back; the layout is saved under `persist`. |
| `window`    | `(window (title Inspector) (open false) (x 120) (y 96) (width 360) (height 280) ...)`          | A floating, movable, resizable non-modal dialog. It stays inside the viewport and is raised by the layer manager.                                                                             |
| `app-shell` | `(app-shell (breakpoints 640 1024) (bottom-bar tabs) (rail rail-nav) (drawer drawer-nav) ...)` | A bottom bar up to the first breakpoint, a rail up to the second one and a drawer from it on. The shell fills the viewport, its content scrolls, and it writes its `mode` attribute.          |

Parse layout documents with `{ vocabulary: layoutVocabulary() }` so their
properties are checked; `LAYOUT_VOCABULARY_TEXT` is the same vocabulary as
Links Notation.

### Keyboard

| Element   | Keys                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Divider   | Arrows move by 1 (Shift: 10). Home gives the smallest size (collapses a collapsible pane), End the largest. Enter collapses or restores the pane. |
| Tab strip | Left and Right select, Home and End go to the ends, Delete closes a closable tab, Ctrl+Shift+Left and Right reorder.                              |
| Window    | Alt+Arrow moves by 16px, Alt+Shift+Arrow resizes, Escape closes and gives the focus back to the opener.                                           |
| Dock      | The "Panel actions" menu (⋮) moves, floats, closes or collapses the shown panel. Ctrl+F6 and Ctrl+Shift+F6 go to the next and previous panel.     |

### Events

The elements change themselves and tell the application, which may write the
change back to its store: `split-resize` (`detail.sizes`), `tab-change`
(`detail.active`), `tab-close` (`detail.panel`), `tab-reorder`
(`detail.order`), `window-change` (`detail.rect`), `window-close`
(`detail.id`), `dock-change` (`detail.layout`, `detail.lino`) and
`shell-mode` (`detail.mode`).

### Render options

`mountDocument(..., { layout: { storage, layers } })`:

- `storage`: an object with `getItem` and `setItem` (such as
  `localStorage`). Splits with `remember-size` and docks with `persist` use
  it.
- `layers`: a layer manager (`createLayerManager()`); by default one is
  shared by the document.

### Pure models

The models have no DOM and return new values.

#### Layer manager

```js
import {
  createLayerManager,
  LAYERS,
} from '@link-foundation/ui-components/layout';

const layers = createLayerManager();
layers.register('confirm', 'modal');
layers.register('inspector', 'window');
layers.raise('inspector');
layers.zIndexOf('confirm') > layers.zIndexOf('inspector'); // true
```

The layers have a fixed order (`LAYERS`: `base`, `dock`, `window`,
`popover`, `modal`, `toast`). Raising a surface moves it only within its
layer, so a raised window never covers a modal.

#### Split sizes

```js
import {
  resizeSplit,
  collapsePane,
} from '@link-foundation/ui-components/layout';

resizeSplit([30, 70], 0, 60, { min: 20, max: 75 }); // [75, 25]
collapsePane([30, 70], 0, { min: 20, collapsible: true }); // [0, 100]
```

`resizeSplit`, `collapsePane`, `restorePane` and `normalizeSizes` keep the
total and every pane within its `min` and `max` (a collapsed pane is 0).

#### Dock layout

```js
import {
  dockLayoutFromLinks,
  dockLayoutToLino,
  movePanel,
} from '@link-foundation/ui-components/layout';

const layout = dockLayoutFromLinks(`(designer: dock
  (persist designer.layout)
  (left: region (size 16rem) (panels toolbox outline))
  (right: region (size 20rem) (panels properties))
  (center: region (panels canvas)))`);
dockLayoutToLino(movePanel(layout, 'outline', 'right'));
// (designer: dock
//   (persist designer.layout)
//   (left: region (size 16rem) (panels toolbox))
//   (right: region (size 20rem) (panels properties outline))
//   (center: region (panels canvas)))
```

`movePanel`, `floatPanel`, `closePanel`, `restorePanel`, `activatePanel` and
`updateRegion` change a layout. Floating and closed panels are written as
`(float PANEL (x ...) (y ...) (width ...) (height ...) (region SIDE))` and
`(closed PANEL SIDE)`. Reading the written text gives the same layout back.

## Future work

The machine format starts small on purpose. These are not supported yet:

- **nested (hierarchical) states**: `(state open (state loading) ...)`
- **parallel states**: regions that are active at the same time
- **history states**: re-entering the last active child state
- event payload guards with arguments, and spawned or invoked child machines
- more reference machines (`dialog`, `menu`, `tabs`, `listbox`) on top of
  the a11y helpers

## License

[Unlicense](LICENSE)
