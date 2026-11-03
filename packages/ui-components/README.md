# @link-foundation/ui-components

Behaviour and components for the associative UI framework, written in
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
- **One link** (`./links-view`): `link-view` draws a single link from LiNo
  with the [links-visuals](https://github.com/link-foundation/links-visuals)
  geometry, as SVG or on a canvas, with its own zoom and pan.

```sh
npm install @link-foundation/ui-components
```

| Entry point                                   | What it has                                              | DOM |
| --------------------------------------------- | -------------------------------------------------------- | --- |
| `@link-foundation/ui-components`              | everything below except `./behavior/dom`                 | yes |
| `@link-foundation/ui-components/behavior`     | `parseMachine`, `interpret`, `createActionRegistry`, ... | no  |
| `@link-foundation/ui-components/behavior/dom` | `mountBehavior`, `BEHAVIOR_CSS`                          | yes |
| `@link-foundation/ui-components/a11y`         | `trapFocus`, `createRovingTabindex`, `bindKeys`, ...     | yes |
| `@link-foundation/ui-components/links-view`   | `defineLinkView`, `linkGeometry`, `renderLinkSvg`, ...   | yes |

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

## One link: `link-view`

`link-view` draws a single link. The geometry, markers and colours follow
[links-visuals](https://github.com/link-foundation/links-visuals) (Unlicense).
The element reads its model from Links Notation through the official parser
(`@link-foundation/ui-core` over `links-notation`) and draws it as SVG (the
default) or on a canvas. Each element has its own zoom and pan, and asks for
no animation frame while nothing moves.

```html
<link-view
  lino="(simple: link-view (link (id 1) (source 1) (target 2)) (markers (source bar) (target arrow)))"
></link-view>

<script type="module">
  import { defineLinkView } from '@link-foundation/ui-components';
  defineLinkView(window);
</script>
```

The model, as LiNo:

```lino
(simple: link-view
  (link (id 1) (source 1) (target 2))
  (markers (source bar) (target arrow))
  (blueprint true)
  (grid true))
```

- **Ends.** A `source` or `target` that is missing or `0` is a free end, drawn
  with a `cross` unless a marker is given. A link whose source and target are
  the same reference is a self-loop.
- **Markers.** `bar`, `arrow`, `cross`, `dot` and `none`. They are data in
  `markers.js` (`MARKERS`), which the SVG renderer (`svgMarkerDefs`) and the
  Canvas renderer (`drawMarker`, `Path2D`) both draw from.
- **Blueprint.** `(blueprint true)` shows the nine construction points: start
  green, end red, centre black (the line colour in dark mode), the others
  blue, with a dashed guide. `(grid true)` draws the grid behind the link.
- **Attributes.** `renderer` (`svg` or `canvas`), `theme` (`light` or
  `dark`; by default it follows `prefers-color-scheme`), `blueprint`, `grid`,
  `bend` and `label` override the LiNo model.
- **Accessibility.** The element has `role="img"` and is focusable. Its name
  comes from the model, for example "Link 1 from 1 to 2", "Link 2 from 3 to
  3, a self-loop" or "Link 3 from 1 to a free end".
- **Keyboard.** `+` and `-` zoom, `0` resets, and the arrow keys pan.
- **Pointer.** The wheel zooms around the pointer by `0.999 ** delta`. A drag
  pans, with pointer capture, and two fingers pinch. The zoom stays between
  0.1 and 20.
- **Colours.** The colours are ui-tokens design tokens (`color.link.*`, with
  a `dark` mode, in `LINK_TOKENS`). A page can override them with the
  `--color-link-*` CSS custom properties.

In a ui-dom document, `registerLinkViewKind(window)` renders a `link-view`
element of the document as this element.

### Building blocks

All of these are pure functions, or objects you create, with no
module-level state:

| Module             | Exports                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `geometry.js`      | `linkGeometry`, `pointAtLength`, `endAngles`, `catmullRomToCubics`, `pathToSvgD` … |
| `markers.js`       | `MARKERS`, `getMarker`, `svgMarkerDefs`, `drawMarker`                              |
| `render-svg.js`    | `renderLinkSvg(geometry, style)`: a deterministic SVG string                       |
| `render-canvas.js` | `drawLinkCanvas(ctx, geometry, style)`                                             |
| `zoom-pan.js`      | `createZoomPan(element, {min, max, onChange})`, which `destroy()` undoes           |
| `animator.js`      | `createAnimator({now, raf, caf, reducedMotion})`                                   |
| `model.js`         | `parseLinkView(text)`, `readLinkView(raw)`, `accessibleName(model)`                |
| `link-view.js`     | `defineLinkView(window)`, `registerLinkViewKind(window)`                           |

```js
import {
  linkGeometry,
  linkColors,
  renderLinkSvg,
} from '@link-foundation/ui-components';

const geometry = linkGeometry({
  source: { x: 0, y: 0 },
  target: { x: 100, y: 0 },
});
const svg = renderLinkSvg(geometry, {
  width: 320,
  height: 200,
  colors: linkColors(),
  ends: { source: 'bar', target: 'arrow' },
});
```

The gallery `examples/link-view.html` shows four cases: simple, self-loop,
free end and blueprint. Serve the repository with
`node scripts/serve-static.mjs` and open
`/packages/ui-components/examples/link-view.html`. It loads every module from
the repository, never from a CDN.

### Tests

```bash
node --test packages/ui-components/tests/links-view/*.test.js
npx playwright test packages/ui-components/tests/e2e/link-view.spec.js
```

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
