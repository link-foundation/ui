# @link-foundation/ui-components

Components of the associative UI framework, written in
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
- **Icons** (`./icons`): a public-domain icon set of our own, the icon
  registry, the `ui-icon` element, and adapters for Lucide, Tabler and
  Material Symbols that emit licence records ([Icons](#icons)).

```sh
npm install @link-foundation/ui-components
```

| Entry point                                           | What it has                                              | DOM |
| ----------------------------------------------------- | -------------------------------------------------------- | --- |
| `@link-foundation/ui-components`                      | everything below except `./behavior/dom` and adapters    | yes |
| `@link-foundation/ui-components/behavior`             | `parseMachine`, `interpret`, `createActionRegistry`, ... | no  |
| `@link-foundation/ui-components/behavior/dom`         | `mountBehavior`, `BEHAVIOR_CSS`                          | yes |
| `@link-foundation/ui-components/a11y`                 | `trapFocus`, `createRovingTabindex`, `bindKeys`, ...     | yes |
| `@link-foundation/ui-components/icons`                | `resolveIcon`, `registerIconSet`, `ui-icon`, ...         | yes |
| `.../icons/adapters/{lucide,tabler,material-symbols}` | an icon source over the npm package of the set           | no  |

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

## Icons

- a public-domain (CC0-1.0) icon set of our own;
- the `ui-icon` element and the `icon` kind of
  [`@link-foundation/ui-dom`](../ui-dom/README.md);
- adapters for Lucide, Tabler and Material Symbols. Every icon they supply
  carries its licence record.

```js
import {
  registerIconSet,
  resolveIcon,
} from '@link-foundation/ui-components/icons';
import { createLucideSource } from '@link-foundation/ui-components/icons/adapters/lucide';

await resolveIcon('close'); // {viewBox, body, mirrorInRtl, record, set: 'own'}
registerIconSet('lucide', createLucideSource());
await resolveIcon({ set: 'lucide', name: 'check' }); // record: ISC, Lucide
```

```html
<ui-icon name="close"></ui-icon>
<!-- decorative: aria-hidden -->
<ui-icon set="lucide" name="check" label="Done"></ui-icon>
<!-- role="img", named "Done" -->
```

```lino
(app: document
  (icon close)
  (ok: icon (set lucide) (name check) (label 'Done')))
```

The complete example is `examples/ui-components-icons.mjs`. The gallery
`examples/icons.html` shows every set in light and dark themes and in both
text directions. To serve it, run `node scripts/build-icons.mjs` and then
`node scripts/serve-static.mjs`, and open
`/packages/ui-components/examples/icons.html`.

### The own set

[`assets/icons/own/`](../../assets/icons/own/) holds 32 icons, each with a
record in [`assets/assets.lino`](../../assets/assets.lino) (CC0-1.0, copyright
`none`). They follow these rules:

- a 24×24 grid with a 2 px stroke;
- round caps and joins;
- `currentColor`, so an icon takes the colour of the text around it and
  follows the theme.

The names are `ICON_NAMES`: `close`, `menu`, `more`, the chevrons, `check`,
`plus`, `minus`, `search`, `settings`, `reset`, `copy`, `paste`, `send`,
`attach`, `drag-handle`, the dock icons, `float`, `zoom-in`, `zoom-out`, `fit`,
`play`, `pause`, `record`, `warning`, `error`, `info` and `link`. `send`
and `reset` point in the reading direction (`MIRROR_IN_RTL`), so they are
mirrored in right-to-left text.

### The registry

| Export                                                       | Meaning                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `registerIconSet(set, source)`                               | add or replace a set. It returns a function that unregisters the set. Rendered icons of the set redraw.                                   |
| `resolveIcon(ref)`                                           | resolves `close`, `lucide:check` or `{set, name}` to `IconData`. A missing name falls back to the own set and then to `PLACEHOLDER_ICON`. |
| `iconRecords(sets?)`                                         | the asset records of the registered sets, for attribution screens                                                                         |
| `createStaticSource(module)`                                 | a source over a module built by `scripts/build-icons.mjs` (`dist/icons/<set>.js`)                                                         |
| `parseIconRef`, `iconSets`, `getIconSet`, `onIconSetsChange` | helpers                                                                                                                                   |

`IconData` is `{viewBox, body, mirrorInRtl, record}`. `body` is SVG markup
drawn in `currentColor`. `record` is the asset record, in the format of
[docs/licensing.md](../../docs/licensing.md).

### The element

`ui-icon` is defined on import in browsers. In other windows, such as jsdom,
call `defineIconElement(window)`. It has these attributes:

- `name`;
- `set` (the default is `own`);
- `label`;
- `mirror` (`true` or `false`, which overrides `MIRROR_IN_RTL`).

Without a label the icon is decorative (`aria-hidden="true"`). With a label it
is `role="img"`, and the label is its accessible name. The default size is
1.5em; `--ui-icon-size` changes it. Markup from a source is cleaned before it
is shown: scripts, `foreignObject`, event handlers and external `href`s are
removed.

ui-core `ui-dialect/0` has no `icon` kind yet; see
[docs/spec/open-questions.md](../../docs/spec/open-questions.md). To read
`(icon ...)` without warnings, parse with `iconVocabulary()`.

### Adapters

| Entry point                       | Package (optional peer)              | Licence                                                   |
| --------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `icons/adapters/lucide`           | `lucide` (≥ 1.0)                     | ISC, or `ISC AND MIT` for icons derived from Feather      |
| `icons/adapters/tabler`           | `@tabler/icons` (≥ 3.0)              | MIT                                                       |
| `icons/adapters/material-symbols` | `@material-symbols/svg-400` (≥ 0.40) | Apache-2.0. Its LICENSE and a NOTICE ship with the icons. |

Install a package only if you use its set. Each adapter maps the logical names
to library names and reads the SVG files through the module resolver: a
`file:` URL in Node, Bun and Deno, or `fetch` with a browser import map. Pass
`{load}` to read from your own copy instead. Records give the source, the SPDX
licence, the copyright and a link to the notice. Every record has
`(attribution required)`.

### Building

`node scripts/build-icons.mjs` (also `npm run build:icons`) writes
`packages/ui-components/dist/icons/`:

- `<set>.js` and a `<set>.svg` sprite for each set (`<symbol
id="<set>-<name>">`);
- `NOTICE.lino`, with every shipped record;
- `ATTRIBUTION.md`;
- `licenses/<set>/`.

SVGO cleans every icon, and fixed colours become `currentColor`. The build
fails, and writes nothing, when:

- a used icon has no record;
- a licence is not on the allow list;
- a record or a dependency names Remix Icon or SF Symbols (see
  [docs/licensing.md](../../docs/licensing.md)).

`--check` validates without writing, and fails when `src/icons/own-icons.js` is
stale. CI runs it in the Licensing workflow.

## Future work

The machine format starts small on purpose. These are not supported yet:

- **nested (hierarchical) states**: `(state open (state loading) ...)`
- **parallel states**: regions that are active at the same time
- **history states**: re-entering the last active child state
- event payload guards with arguments, and spawned or invoked child machines
- more reference machines (`dialog`, `menu`, `tabs`, `listbox`) on top of
  the a11y helpers

## License

The code is [Unlicense](LICENSE). The own icons are CC0-1.0. Third-party
icons keep their licences, as recorded in [Adapters](#adapters).
