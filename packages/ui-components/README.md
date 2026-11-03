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
- **Charts** (`./charts`): a chart dialect in the grammar of Vega-Lite
  (`data`, `mark`, `encoding`), a deterministic SVG renderer, `<ui-chart>`
  with a data table twin and keyboard navigation, and the small charts
  `<ui-stat-tile>`, `<ui-gauge>` and `<ui-sparkline>`. The ECharts adapter
  (`./charts/echarts`) is loaded only for `(renderer echarts)`.
- **Diagrams in LiNo** (`./diagrams`): flowchart, state, sequence and class
  diagrams laid out by Dagre, drawn as accessible SVG, exported to Mermaid
  text or drawn by a lazily loaded Mermaid adapter. See [Diagrams](#diagrams).
- **One link** (`./links-view`): `link-view` draws a single link from LiNo
  with the [links-visuals](https://github.com/konard/links-visuals)
  geometry, as SVG or on a canvas, with its own zoom and pan.
- **Layout and windowing** (`./layout`, `./layout.css`): `stack`, `grid`,
  `split`, `tab-group`, `dock`, `window` and `app-shell` kinds for ui-dom,
  a layer manager, and dock layouts saved as Links Notation.
- **Basic controls** (`./controls`, `./controls.css`): button,
  icon-button, label, link, text-field, text-area, number-field,
  color-field, checkbox, radio-group, switch, slider, select, combobox,
  progress, badge and avatar as ui-dom kinds over native elements, each
  with its WAI-ARIA pattern, a LiNo machine and stories
  ([Basic controls](#basic-controls)).
- **Icons** (`./icons`): a public-domain icon set of our own, the icon
  registry, the `ui-icon` element, and adapters for Lucide, Tabler and
  Material Symbols that emit licence records ([Icons](#icons)).

```sh
npm install @link-foundation/ui-components
```

| Entry point                                           | What it has                                                             | DOM |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | --- |
| `@link-foundation/ui-components`                      | everything below except `./behavior/dom` and adapters                   | yes |
| `@link-foundation/ui-components/behavior`             | `parseMachine`, `interpret`, `createActionRegistry`, ...                | no  |
| `@link-foundation/ui-components/behavior/dom`         | `mountBehavior`, `BEHAVIOR_CSS`                                         | yes |
| `@link-foundation/ui-components/a11y`                 | `trapFocus`, `createRovingTabindex`, `bindKeys`, ...                    | yes |
| `@link-foundation/ui-components/charts`               | `parseChart`, `renderChartSvg`, `defineChartElements`, ...              | yes |
| `@link-foundation/ui-components/charts/echarts`       | `toEChartsOption`, `renderECharts`                                      | yes |
| `@link-foundation/ui-components/diagrams`             | `parseDiagram`, `toMermaid`, `defineDiagram`, ...                       | yes |
| `@link-foundation/ui-components/layout`               | the layout kinds, `createLayerManager`, `resizeSplit`, `movePanel`, ... | yes |
| `@link-foundation/ui-components/layout.css`           | the CSS of the layout kinds                                             |     |
| `@link-foundation/ui-components/controls`             | `mountControls`, `registerControls`, `nextValue`, `parseStories`, ...   | yes |
| `@link-foundation/ui-components/controls.css`         | the token-only CSS of the basic controls                                |     |
| `@link-foundation/ui-components/links-view`           | `defineLinkView`, `linkGeometry`, `renderLinkSvg`, ...                  | yes |
| `@link-foundation/ui-components/icons`                | `resolveIcon`, `registerIconSet`, `ui-icon`, ...                        | yes |
| `.../icons/adapters/{lucide,tabler,material-symbols}` | an icon source over the npm package of the set                          | no  |

## A machine in LiNo

```lino
toggle-machine: machine
  initial off
  context
    pressed false
    disabled false
  action set-pressed
    set pressed true
  action clear-pressed
    set pressed false
  state off
    on toggle
      target on
      do set-pressed
      when not-disabled
  state on
    on toggle
      target off
      do clear-pressed
      when not-disabled
  part root
    attr aria-pressed
      context pressed
    key Enter toggle
    key Space toggle
    on press toggle
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

## Charts

You describe a chart with the grammar of
[Vega-Lite](https://vega.github.io/vega-lite/): `data`, `mark` and
`encoding`. The package checks it, writes it back as Links Notation, and
renders it as an SVG. The SVG is the same for the same spec every time.

The `<ui-chart>` element shows that SVG with an accessible name, a data
table twin and keyboard navigation between the points. `<ui-stat-tile>`,
`<ui-gauge>` and `<ui-sparkline>` are smaller charts.

The charts use `links-notation` (the parser),
[d3-scale](https://d3js.org/d3-scale) and [d3-shape](https://d3js.org/d3-shape).
Both d3 packages are pinned and served from `node_modules`, never from a CDN.
[ECharts](https://echarts.apache.org) is an optional peer dependency. It is
loaded only for a chart with `(renderer echarts)`.

```js
import {
  ChartSpecError,
  chartToLino,
  parseChart,
  renderChartSvg,
} from '@link-foundation/ui-components';

const spec = parseChart(`(sales: chart
  (title 'Monthly sales')
  (description 'Sales grew from 12 to 30 thousand in the first half of 2026')
  (data
    (row (month 2026-01) (value 12))
    (row (month 2026-02) (value 18))
    (row (month 2026-03) (value 30)))
  (mark line (point true))
  (encoding
    (x (field month) (type temporal))
    (y (field value) (type quantitative))))`);

const svg = renderChartSvg(spec); // '<svg ... role="img" aria-label="Sales grew ...">'
renderChartSvg(spec) === svg; // true: no clock, no random ids
parseChart(chartToLino(spec)); // equal to spec

try {
  parseChart('(c: chart (data (row (a 1))) (mark pie))');
} catch (error) {
  error instanceof ChartSpecError; // true
  error.code; // 'unknown-mark'
  error.path; // [0, 2]
  error.message; // 'unknown mark "pie" (expected ...) (at link 1 > 3: (mark pie))'
}
```

In a page:

```html
<script type="module">
  import { defineChartElements } from '@link-foundation/ui-components';
  defineChartElements(window);
</script>

<ui-chart>
  <script type="text/lino">
    (sales: chart
      (description 'Sales grew from 12 to 30 thousand')
      (data (row (month 2026-01) (value 12)) (row (month 2026-02) (value 30)))
      (mark bar)
      (encoding (x (field month) (type ordinal)) (y (field value) (type quantitative))))
  </script>
</ui-chart>
<ui-gauge label="CPU" value="72" unit="%"></ui-gauge>
<ui-stat-tile
  label="Revenue"
  value="30200"
  unit="USD"
  delta="12.5"
  trend="12 18 15 21 25 30"
></ui-stat-tile>
<ui-sparkline label="Visits" values="3 5 2 8 6 9" mark="area"></ui-sparkline>
```

The gallery `examples/charts.html` shows every mark. To open it, run
`node scripts/serve-static.mjs` from the repository root and go to
http://127.0.0.1:4173/packages/ui-components/examples/charts.html.

### Grammar

A chart is a `chart` element with an id:

| Link                                      | Meaning                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `(title 'text')`                          | Optional. Shown above the chart and used as the table caption.                                                                 |
| `(description 'text')`                    | The accessible name of the chart. Without it, the title is used, and without a title, a summary of the data.                   |
| `(data (row (FIELD VALUE) ...) ...)`      | The data rows. Numbers become numbers; other values stay text.                                                                 |
| `(mark TYPE OPTION...)`                   | `line`, `area`, `bar`, `point` or `arc`.                                                                                       |
| `(encoding (CHANNEL (field F) (type T)))` | Which field goes to which channel. `T` is `quantitative`, `temporal`, `ordinal` or `nominal`. `(title 'text')` names the axis. |
| `(renderer svg)` / `(renderer echarts)`   | Optional. `svg` is the default.                                                                                                |
| `(width N)` / `(height N)`                | Optional. The default is 640 × 360.                                                                                            |

The channels of each mark:

| Mark           | Channels                             | Options                                                         |
| -------------- | ------------------------------------ | --------------------------------------------------------------- |
| `line`, `area` | `x`, `y`, `color`, `tooltip`         | `(interpolate linear\|monotone\|step)`, `(point true)` for dots |
| `bar`          | `x`, `y`, `color`, `tooltip`         |                                                                 |
| `point`        | `x`, `y`, `color`, `size`, `tooltip` |                                                                 |
| `arc`          | `theta`, `color`, `tooltip`          | `(inner-radius N)` for a donut                                  |

Bars and areas with a `color` field are stacked. `tooltip` takes one field,
`(tooltip (field f) (type t))`, or several,
`(tooltip ((field a) (type t)) ((field b) (type t)))`.

The small charts are elements too, so they can be written in Links Notation
as well: `(cpu: gauge (label CPU) (value 72) (unit %))`, `stat-tile` and
`sparkline`.

#### Errors

`chartFromLinks` and `parseChart` throw a `ChartSpecError` for a bad spec.
It has a `code`, a `reason`, the `path` of the link (the index of each link
from the top) and the `link` itself, written back as Links Notation. The
message ends with the position, for example `(at link 1 > 3: (mark pie))`.
Among the codes are `unknown-mark`, `unknown-type`, `missing-field`,
`missing-mark`, `invalid-data`, `invalid-value`, `empty-data` and
`duplicate-property`.

### API

| Export                                         | What it does                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `parseChart(text)`                             | Parse one chart (or small chart) written in Links Notation.                        |
| `chartFromLinks(links)` / `chartsFromLinks()`  | Read the links of the official parser into a spec (or all specs).                  |
| `chartToLino(spec)`                            | Write a spec back. `parseChart(chartToLino(spec))` is equal to `spec`.             |
| `layoutChart(spec, options)`                   | Scales, series and points in pixels: what the renderers share.                     |
| `renderChartSvg(spec, options)`                | The SVG as a string. The same spec always gives the same SVG.                      |
| `summarizeChart`, `chartLabel`, `chartTable`   | The accessible name, the summary and the table twin of a spec.                     |
| `CHART_TOKENS`, `CHART_CSS`, `chartTokensLino` | The chart colour tokens as values, as CSS custom properties and as Links Notation. |
| `defineChartElements(window)`                  | Define `<ui-chart>`, `<ui-stat-tile>`, `<ui-gauge>` and `<ui-sparkline>`.          |

`renderChartSvg` uses CSS custom properties for colours. Pass
`{ tokens: CHART_TOKENS.light }` to write literal colours instead, for
example for a file.

### Accessibility

Every chart element renders:

- an SVG with `role="img"` and an `aria-label` taken from `(description ...)`;
- a visually hidden data table with a caption, one row per data row, and a
  **Show data table** button (`aria-expanded`, `aria-controls`) that shows it;
- a polite `aria-live` region that announces the focused point.

The chart is one tab stop. With the focus on it:

| Key                       | Action                                         |
| ------------------------- | ---------------------------------------------- |
| `ArrowRight`, `ArrowLeft` | The next or previous point of the series.      |
| `ArrowDown`, `ArrowUp`    | The same point in the next or previous series. |
| `Home`, `End`             | The first or last point.                       |
| `Escape`                  | Hide the tooltip and the focus ring.           |

Each move shows a tooltip and a focus ring, announces the point (for
example `Month: Jan 2026, Sales, thousand USD: 12, point 1 of 6`), and
sends a `chart-point` event. A bad spec shows a `role="alert"` message and
sends a `chart-error` event with the `ChartSpecError`.

The colours are checked in light and dark: every series colour has at least
3:1 contrast with the chart background, and the chart text has at least 4.5:1.

### Tokens

| Token                                 | Light                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `color.chart.1` … `color.chart.8`     | `#1f6fb2`, `#c2410c`, `#15803d`, `#b91c5c`, `#6d28d9`, `#0e7490`, `#a16207`, `#4b5563` |
| `color.chart.background`, `.text`     | `#ffffff`, `#1c1b1f`                                                                   |
| `color.chart.muted`, `.axis`, `.grid` | `#5f6368`, `#5f6368`, `#e3e3e8`                                                        |
| `color.chart.focus`                   | `#1c1b1f`                                                                              |

The dark values apply with `prefers-color-scheme: dark` or
`data-theme="dark"` on an ancestor. They become CSS custom properties such
as `--color-chart-1`, so a theme can override them. `chartTokensLino()`
writes them as a `@link-foundation/ui-tokens` theme.

### ECharts

```js
import { toEChartsOption } from '@link-foundation/ui-components/charts/echarts';

const option = toEChartsOption(spec, { theme: 'dark' }); // plain data, no functions
```

`toEChartsOption` is pure. It gives the same option for the same spec, with
the literal token colours of the theme. With `(renderer echarts)`,
`<ui-chart>` loads the adapter with `import('./echarts-adapter.js')`, and the
adapter loads `import('echarts')`. ECharts then draws the chart. The SVG
stays in the page, visually hidden, as the accessible image, and the
keyboard moves show the ECharts tooltip. Charts without
`(renderer echarts)` never load either module, so a bundler puts ECharts
in a lazy chunk. `tests/charts/bundle.test.js` checks this.

## Diagrams

A flowchart, state, sequence or class diagram is a `diagram` link.
[Dagre](https://github.com/dagrejs/dagre) (MIT) lays it out and our own SVG
renderer draws it. It can also be written out as Mermaid text, or drawn by
[Mermaid](https://mermaid.js.org) (MIT), which is loaded only when a page
shows a Mermaid diagram.

```lino
login-flow: diagram
  kind flowchart
  direction down
  start: node
    label 'Start'
  check: node
    label 'Signed in?'
    shape diamond
  home: node
    label 'Home'
  edge
    from start
    to check
  edge
    from check
    to home
    label 'yes'
```

```js
import { defineDiagram } from '@link-foundation/ui-components';

defineDiagram();
const diagram = document.createElement('ui-diagram');
diagram.source = loginFlowLino; // the LiNo above
document.body.append(diagram);
```

The LiNo can also be the text content of `<ui-diagram>`.
See [`examples/diagrams.html`](examples/diagrams.html). Run
`node scripts/serve-static.mjs` from the repository root and open
`http://127.0.0.1:4173/packages/ui-components/examples/diagrams.html`.

### The diagram dialect

| Link                              | Meaning                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `(ID: diagram …)`                 | a diagram; the ID names it                                                                                   |
| `(kind K)`                        | `flowchart` (default), `state`, `sequence` or `class`                                                        |
| `(direction D)`                   | `down` (default), `up`, `right` or `left`                                                                    |
| `(label 'Text')`                  | the title of the diagram (used by screen readers)                                                            |
| `(renderer R)`                    | `svg` or `mermaid`; by default `svg` for flowcharts and states and `mermaid` for sequence and class diagrams |
| `(layout NAME)`                   | a registered layout engine (default `dagre`)                                                                 |
| `(ID: node …)`                    | a node with `(label …)`, `(shape …)` and `(group ID)`                                                        |
| `(shape S)`                       | `box` (default), `round`, `stadium`, `circle`, `diamond`, `start` or `end`                                   |
| `(edge (from A) (to B) …)`        | a connection, with an optional `(label …)`; `(ID: edge …)` names it                                          |
| `(ID: group (label …) (group P))` | a group (subgraph, composite state) inside group `P` if given                                                |

The nested form, the one-line form `(f: diagram (a: node) (b: node))` and
the multi-line parenthesized form give the same model. `parseDiagram` reads
the first diagram of a text, `diagramsFromLinks` every diagram of a parsed
document, and `diagramToLino` writes a model back in the nested form:
`diagramFromLinks(parse(diagramToLino(model)))` equals `model`. Every error is a `DiagramError` with a `code` (`no-diagram`,
`unknown-property`, `invalid-value`, `missing-value`, `duplicate-id`,
`unknown-node`, `unknown-group`) and an `at` position: the index path of the
link and its text, since `links-notation` gives no line numbers.

### API

```js
import {
  parseDiagram, // LiNo text → DiagramModel
  diagramFromLinks, // links-notation links → DiagramModel
  diagramToLino, // DiagramModel → LiNo text
  layoutDiagram, // DiagramModel → Layout (Dagre, deterministic)
  runLayout, // the layout picked by (layout NAME)
  registerLayout, // add a layout engine
  renderDiagramSvg, // DiagramModel + Layout → SVG string
  toMermaid, // DiagramModel → Mermaid text
  defineDiagram, // <ui-diagram> and <ui-mermaid-view>
  setMermaidImporter, // where Mermaid is imported from
} from '@link-foundation/ui-components';
```

`toMermaid` of the login flow above returns, with no trailing newline:

```text
flowchart TD
  start["Start"]
  check{"Signed in?"}
  home["Home"]
  start --> check
  check -->|yes| home
```

`layoutDiagram` gives the same coordinates for the same model every time,
and no two nodes overlap. Node sizes come from the labels
(`estimateNodeSize`), or from `options.nodeSize`.

`renderDiagramSvg(model, layout, tokens)` draws flowcharts and states. The
colours are design tokens (`surface`, `onSurface`, `edge`, `group`,
`groupOutline`, `accent`, `fontFamily`, `fontSize`), which default to the
`--color-*` CSS custom properties of ui-tokens. Every label is escaped.

### Elements

`<ui-diagram>` reads its LiNo from its text content, or from its `source`
property. The `renderer` and `layout` attributes override the ones in the
LiNo. `layoutOptions` and `tokens` are properties. It sets `data-state`
(`loading`, `ready`, `error`) and `data-renderer`, and it fires a
`ui-diagram-state` event. Invalid LiNo is shown as source text with
`role="alert"`.

`<ui-mermaid-view label="…">` draws Mermaid text with Mermaid. Mermaid is
imported the first time one is shown (`import('mermaid')`, or the importer
given to `setMermaidImporter`), with `securityLevel: 'strict'`. While Mermaid
loads, and whenever loading or rendering fails, the view shows the source
text with an error message, so a diagram never just disappears.

#### Accessibility

The drawing has `role="img"` and an `aria-label` that names the diagram and
counts its nodes and connections. A visually hidden list of the nodes and of
the connections ("Signed in? leads to Home (yes)") follows it. The fallback
source is a focusable `pre`. axe finds no WCAG 2.2 A/AA violation on the
example page.

### Layout plugins and licences

This package depends only on MIT and Unlicense code: Dagre and
`links-notation`. Mermaid is an optional peer dependency (`^11 || ^12`).
Mermaid 11 brings in no EPL code. **Mermaid 12 depends on `elkjs`
(EPL-2.0)**, so installing Mermaid 12 is the app's choice.

Other engines, such as ELK.js (EPL-2.0) or Graphviz through
`@hpcc-js/wasm-graphviz`, can be plugged in by the app:

```js
import ELK from 'elkjs/lib/elk.bundled.js'; // EPL-2.0: the app's choice
import { registerLayout } from '@link-foundation/ui-components';

registerLayout('elk', async (model, options) => {
  // … return { width, height, nodes, edges, groups } like layoutDiagram
});
```

Diagrams that should use it write `(layout elk)`. See
`src/diagrams/layout-plugins.js` for the full ELK adapter. A test checks
that no package of this repository lists an EPL package in its
`dependencies`.

## One link: `link-view`

`link-view` draws a single link. The geometry, markers and colours follow
[links-visuals](https://github.com/konard/links-visuals) (Unlicense).
The element reads its model from Links Notation through the official parser
(`@link-foundation/ui-core` over `links-notation`) and draws it as SVG (the
default) or on a canvas. Each element has its own zoom and pan, and asks for
no animation frame while nothing moves.

```html
<link-view
  lino="(simple: link-view (link (id 1) (source 1) (target 2)) (markers (source bar) (target arrow)))"
></link-view>

<script type="module">
  import { defineLinkView } from '@link-foundation/ui-components/links-view';
  defineLinkView(window);
</script>
```

The model, as LiNo:

```lino
simple: link-view
  link
    id 1
    source 1
    target 2
  markers
    source bar
    target arrow
  blueprint true
  grid true
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
| `split`     | `(split (sizes 30 70) (min 20) (collapsible true false) (remember-size chat.split) ...)`       | Panes with dividers (WAI-ARIA window splitter). Sizes are percentages with a constant total. `remember-size` keeps `sizes 30 70` in the render storage.                                       |
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

The keys are bound with `bindKeys` of [`./a11y`](#accessibility-helpers), so only
these exact combinations act (a divider leaves Ctrl+Arrow to the browser),
and the menus move their focus with `createRovingTabindex`.

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

const layout = dockLayoutFromLinks(`designer: dock
  persist designer.layout
  left: region
    size 16rem
    panels toolbox outline
  right: region
    size 20rem
    panels properties
  center: region
    panels canvas`);
dockLayoutToLino(movePanel(layout, 'outline', 'right'));
// designer: dock
//   persist designer.layout
//   left: region
//     size 16rem
//     panels toolbox
//   right: region
//     size 20rem
//     panels properties outline
//   center: region
//     panels canvas
```

`movePanel`, `floatPanel`, `closePanel`, `restorePanel`, `activatePanel` and
`updateRegion` change a layout. The layout is written in the nested form;
a floating panel is a `float PANEL` line with the indented lines `x ...`,
`y ...`, `width ...`, `height ...` and `region SIDE`, and a closed panel is a
`closed PANEL SIDE` line. Reading the written text gives the same layout
back, and the parenthesized form reads the same.

## Basic controls

`./controls` adds the basic controls to ui-dom. Each kind renders native
elements in light DOM (a `<button>`, an `<input>`, ...) with Open UI part
names in `data-part`, follows its
[APG pattern](https://www.w3.org/WAI/ARIA/apg/patterns/) and, when it has
state, runs its machine (`src/controls/machines/<kind>.lino`).

```js
import { mountControls } from '@link-foundation/ui-components/controls';

const mounted = mountControls(
  form,
  `(settings: document
  (email: text-field 'Email' (name email) (type email) (required true))
  (wifi: switch 'Wi-Fi' (name wifi) (checked true))
  (volume: slider 'Volume' (name volume) (min 0) (max 100) (step 5) (value 40))
  (save: button 'Save' (on press (emit save))))`
);
mounted.store.get('volume'); // the committed values live in the store
```

```html
<link rel="stylesheet" href="@link-foundation/ui-components/controls.css" />
```

`mountControls(container, text, options)` is `mountBehavior` with the
control kinds: every value a control commits is written to the store with
one `setProp` (one transaction per user change), then the element's
`(on change ...)` handlers run. `registerControls()` registers the kinds
with ui-dom for `mountDocument`; parse with
`{ vocabulary: controlsVocabulary() }` to check their properties.

| Kind           | Element and role                               | Keyboard                                                                     |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `button`       | `<button type=button>`                         | Enter, Space                                                                 |
| `icon-button`  | `<button aria-label>`; no `label` is an error  | Enter, Space                                                                 |
| `label`        | `<label for>` of a control                     |                                                                              |
| `link`         | `<a href>`; unsafe URLs are never followed     | Enter                                                                        |
| `text-field`   | `<input>` and its `<label>`                    | commits on Enter or leaving; Escape restores                                 |
| `text-area`    | `<textarea>` and its `<label>`                 | commits on leaving; Escape restores                                          |
| `number-field` | `<input role=spinbutton>`                      | arrows step (Shift ×10), PageUp/PageDown, Home/End                           |
| `color-field`  | a hex `<input>` and `<input type=color>`       | commits a normalised `#rrggbb`                                               |
| `checkbox`     | `<input type=checkbox>`, `(checked mixed)`     | Space                                                                        |
| `radio-group`  | `radiogroup` of `radio`s, one tab stop         | arrows move and check, Space checks                                          |
| `switch`       | `<button role=switch aria-checked>`            | Space, Enter                                                                 |
| `slider`       | `slider` with `aria-valuenow/min/max/text`     | arrows step (Shift ×10), PageUp/PageDown, Home/End                           |
| `select`       | select-only `combobox` and a `listbox`         | arrows, Home/End open and move, Enter/Space choose, Escape closes, typeahead |
| `combobox`     | `<input role=combobox>` with list autocomplete | typing filters, arrows move, Enter chooses, Escape closes or clears          |
| `option`       | `option` of a select or a combobox             |                                                                              |
| `progress`     | `progressbar`; no `value` is indeterminate     |                                                                              |
| `badge`        | a short status text with a `tone`              |                                                                              |
| `avatar`       | `<img alt>`, or initials with `role=img`       |                                                                              |

Every input control has a `name` and takes part in its native `<form>`
(`FormData`). The key bindings of `bindKeys` ignore keys typed in text
inputs, so a letter typed in a field never fires a page shortcut.
`controls.css` uses only design tokens (with system colour fallbacks), has
`:focus-visible` rings and a `forced-colors: active` block.

### Stories and the catalog

Each control has stories in `stories/<kind>.lino` and an entry in
`src/controls/catalog.lino`:

```lino
button-stories: stories
  component button
  story filled
    button 'Save'
      variant filled
button: control
  title 'Button'
  stories button-stories
  apg button
```

`parseStories`, `parseCatalog` and `storiesDocument` read them; the page
`e2e/pages/controls.html` shows a form of every control and a gallery of
every story. `tests/controls/catalog.test.js` fails when a control lacks
its kind entry, story file, catalog entry or test file.

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
app: document
  icon close
  ok: icon
    set lucide
    name check
    label 'Done'
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

## Overlays and navigation

`@link-foundation/ui-components/overlays` registers dialog, alert-dialog,
popover, tooltip, menu, menu-item, menu-separator, context-menu, radial-menu,
tabs, tab, tab-panel, toast, toaster and drawer. Load `overlays.css` and see
[the overlay guide](../../docs/overlays.md) for LiNo examples, controllers,
keyboard behavior, injected clocks and the runnable gallery.
`positionFloating` is also exported as the shared positioning API for select.

## Lists, trees and tables

Import `@link-foundation/ui-components/data` to register the `list`, `tree`
and `table` ui-dom kinds and load `@link-foundation/ui-components/data.css`.
Parse with `{ vocabulary: dataVocabulary() }`. The
[data gallery](examples/data.html) runs without a bundler when served with
`node scripts/serve-static.mjs`.

```lino
chats: list
  label Chats
  items
    param chats
  selection multi
  virtualized true
  item-height 32
  template chat-row
  on select
    navigate chat
      param item.id

people: table
  caption People
  items
    param people
  columns
    name: column
      label Name
      sortable true
    age: column
      label Age
      sortable true
      align end
```

`items (param chats)` reads `options.data.sources.chats`. A source is an
array or an observable `{ get(): Item[], subscribe(listener): unsubscribe }`;
`createDataSource(items)` provides that adapter with `set(items)`. Each item
has a stable, unique string `id` and a `label` (falling back to `name`, then
`id`). Updating the source retains measurements and focus by ID. Inline
records are also supported:

```lino
choices: list
  label Choices
  items
    (id first) (label First)
    (id second) (label Second)
```

The original issue's `$chats` and `$item.id` examples were working names.
Use the dialect's structured `param` links instead: dollar sigils remain
reserved. `on select` and `on activate` go through ui-dom and the #33 action
registry (`mountBehavior`); `(param item.id)` resolves an own property of the
current item. No action or template text is evaluated. `ui-select` carries
`{item, selected}` and `ui-activate` carries `{item}` for host listeners.

`selection` is `single` (default), `multi`, or `none`. Single selection follows
arrow/typeahead focus; multi selection moves focus independently, Space toggles,
Shift extends a range, Ctrl/Cmd toggles on click, and Ctrl/Cmd+A selects all.
Home/End, PageUp/PageDown and typeahead work on listboxes and trees. Trees
also support Right/Left for expansion/parent navigation and `*` for sibling
expansion. Enter activates; double-click also activates.

A tree item may have `children: Item[]` or `hasChildren: true`. For lazy branches,
provide `options.data.loadChildren(item, {signal}) -> Promise<Item[]>`. Loaded
children are cached by parent ID; loading/error text is announced, closing a
branch during a load leaves it closed, and destroying a render aborts pending
requests. Reopen a failed branch to retry. Tree `aria-level`, `aria-posinset`
and `aria-setsize` describe the complete visible hierarchy, including rows
outside the rendered window.

A table reads `columns` records with `label`, `sortable`, `align` (`start` or
`end`) and `width` (pixels). The caption names the grid. Sort cycles ascending,
descending, none; equal values retain input order and none restores source
order. Arrows move between cells; Home/End move within a row, Ctrl/Cmd+Home/End
move to the first header/last data cell, and Up from the first row reaches the header.
Header arrows navigate columns, Down returns to the data. Space selects
rows and Shift extends selection. Header buttons activate sorting with
Enter/Space. Column dividers resize by pointer drag; focus a divider by clicking
it and use Left/Right (10px), Home (48px), End (600px). The header stays visible
inside the table's scrolling viewport.

`template NAME` selects a trusted host renderer from
`options.data.templates[NAME](item, {document})`, returning a string or a DOM
node. Strings render as text. Listbox options should contain text, without
interactive descendants (use a grid for interactive cells). Tree labels can use
the same template contract. `item-height` is the positive estimated/minimum
height in CSS pixels; actual variable row heights come from one shared
`ResizeObserver` per viewport, with writes deferred to `requestAnimationFrame`.
`virtualized false` deliberately renders the whole collection. Virtualization
is on by default, with one viewport of overscan, retaining focused rows outside
the range. The scroll area is styled through `.ui-data-scroll`; native wheel,
touch and nested scroll chaining are preserved. Each component also accepts
`loading true`, `error 'message'`, and `empty 'message'`.

The DOM-free modules `data/virtual-range.js`, `data/selection-model.js`,
`data/sort-model.js`, and `data/tree-model.js` can be imported by relative source
path internally. Public exports include `listOffsets`, `indexAt`, `listRange`,
`anchorScrollTop`, `selectItem`, `nextSort`, `sortItems`, and `flattenTree`.
The chat kit can reuse them without timeline logic here. `anchorScrollTop`
takes `{keys, offsets, scrollTop}` before, `{keys, offsets}` after, and an anchor
key, preserving that row's intra-row offset. Range ends are exclusive;
`indexAt` returns `-1` for an empty collection.

### Links network

`@link-foundation/ui-components/links-view` also exports `defineLinksNetwork`
and `registerLinksNetworkKind`. Pass `parseOptions: { vocabulary: networkVocabulary() }`
to `mountDocument` when rendering the kind and its LiNo event handlers. Define the element explicitly, set `items` to
`{ id, source, target, label? }[]`, or set `store` to a real `ui-store` instance.
Store nodes of kind `link` use `source`/`target` properties (or the first two
positional values). The subscription applies committed insert, update, remove
and rename events while preserving unrelated SVG items and positions.

```lino
network: links-network
  layout circle
  style glyph
  labels
    min-zoom 0.6
  items
    link
      id a
      source p
      target q
    link
      id b
      source a
      target 0
```

IDs refer to points or the centre anchors of other links; `0` is a free end.
Cycles and self-references are supported. `layout` selects `circle`, `grid`,
`hex`, `spiral`, `force` or `layered` (Dagre). `style-mode` selects `glyph` or
`node-edge`; `theme` selects `light` or `dark` (system by default), with the
same `--color-link-*` overrides as `link-view`. Layout work runs in a
cancellable worker; `ready` resolves when it completes, and `layout()` requests
another layout. Dragged vertices remain pinned across layouts. Force uses a
fixed seed, `alphaMin` and at most 300 ticks, with no ongoing animation.

Click selects; Shift+click toggles an additional item; drag pins a vertex;
background drag pans; the wheel zooms. Home selects the first vertex, arrows
select the nearest neighbour in the pressed direction, Shift+arrows extend the
selection, Enter dispatches `ui-activate` (and the `activate` hook), Escape clears selection, `+`/`-` zoom,
`0` resets, Alt+arrows pan and Shift+F10 opens the `networkcontextmenu` hook.
The hooks bubble across the shadow root with `detail: { id, item, originalEvent }`.
`selectionchange` carries `detail.ids`; `ui-select` carries `detail.item` for LiNo handlers. A live status announces selection in
both SVG and Canvas. The `networkStore` ui-dom render option can supply the
store to a registered kind. Applications handle activation and editing.

Up to 2,000 links use SVG; larger networks use Canvas. Geometry and marker
shapes are shared. Labels hide below the configured zoom and use greedy
priority overlap removal. `toSvg()` returns the preview markup, and
`toPng(scale)` returns a PNG Blob. The pure APIs `buildNetwork`, `NETWORK_LAYOUTS`,
`visibleLabels`, `createLayoutRunner`, `networkToSvg` and `networkToPng` work
independently of the custom element. Worker cancellation rejects with
`AbortError`; other errors appear in `diagnostics` and `layouterror`.

Run `node scripts/serve-static.mjs` and open
`/packages/ui-components/examples/links-network.html` for 10, 500 and 5,000
links. The server and package prepack build the self-contained worker with
pinned npm dependencies and accompanying license notices; there is no CDN or
runtime download. Consumers must preserve the relative
`dist/network-layout.worker.mjs` asset when bundling the package, or inject a
`createWorker` factory for their bundler's worker handling.

## Arbitrary Links Notation as a network

`linoToNetwork(text, { maxInputSize, maxDepth })` reads any LiNo with the
pinned official parser. It returns `{ links, diagnostics, sourceMap }`.
`buildNetwork(links)` accepts the converter's explicit point/value records as
well as link records. Quoted values remain separate from references with the
same text, and isolated words remain visible. Positions are one-based line
and column; parse errors and limit errors are diagnostics rather than throws.

Binary links use their two values as endpoints. Longer sequences start at
the named anchor: `a: b c d` gives a→b, b→c, c→d under IDs a, a/1, a/2.
Nested anonymous links use their parent path, such as a/0; anonymous roots
use @0, @1, etc. Collisions add ~1, ~2, etc. The model reserves 0 for free
ends, so an explicit LiNo ID 0 gets a generated alias. Duplicate definitions
warn and keep the first definition. Ordinary undefined words are labelled
points; undefined numeric IDs warn. This distinction keeps ordinary prose
valid because LiNo has no separate syntax for an unresolved reference.

`networkToLino(result)` (also accepting `result.links` or a built network)
uses the retained LiNo structure and writes nested text with ui-core. IDs,
references, empty links and quoted values survive a conversion round trip.
Formatting is not preserved. Writing view edits into text is outside this API.
Networks without LiNo origin metadata are rejected.

```js
import { defineLinoNetwork } from '@link-foundation/ui-components/links-view';
defineLinoNetwork();
const view = document.createElement('lino-network');
view.textContent = "greeting: hello 'world'";
view.addEventListener('select', ({ detail: { id, line, column } }) => {
  console.log(id, line, column);
});
document.body.append(view);
await view.ready;
```

The element accepts inline text, the `lino` property/attribute, or a `src`
URL (which takes precedence). It displays diagnostics and highlights the
source token selected with the pointer or keyboard. Inline text changes
reload automatically; newer loads cancel older requests. `layout`,
`style-mode`, `theme` and `label` forward to the existing network view.
`network`, `sourceMap`, `diagnostics`, `networkView`, `select(id)`, `toSvg()`
and `toPng(scale)` are available after `ready`. A fetch failure clears the
old view and reports a diagnostic. Imports are safe in Node.

```bash
npx lino-network input.lino --layout force --out network.svg
```

The CLI supports all six network layouts, defaults to circle, and writes
SVG to stdout if `--out` is absent. Input is bounded to 1 MiB; force is
bounded to 300 ticks. Warnings go to stderr; errors exit unsuccessfully.
Run the static server and open
[`examples/lino-network.html`](examples/lino-network.html) for document,
token and other case-study samples, source selection, and error diagnostics.

## Chat kit

The provider-neutral [chat kit](src/chat/README.md) supplies a chat list,
virtual message stream, bubbles, reasoning traces, day separators and a floating
composer. It uses one LiNo data contract, capability-driven actions, bounded
history and four light/dark skins. Try [the 10,000-message example](examples/chat.html).

## Settings panel

Import `createSettingsPanel`, `controlFor` and `buildPanelModel` from
`@link-foundation/ui-components/settings` and load `controls.css` and
`settings.css` from this package. The panel uses the real `ui-settings`
schema engine and the basic controls. See
[`examples/settings.html`](examples/settings.html) (serve with
`node scripts/serve-static.mjs`).

```js
const panel = createSettingsPanel(schema, {
  values,
  previewRoot: document.querySelector('#preview'),
  // target: bindConfig(config, schema, { layer: 'session' }),
  mode: 'drawer', // or 'page' (the default)
  random: seededRandom,
});
document.body.append(panel.element);
openButton.addEventListener('click', () => panel.open(openButton));
// panel.update({ 'liquid.blur': 24 }); panel.values(); panel.destroy();
```

The optional target has `values()`, `update(values)` and
`subscribe(listener)` (returning an unsubscribe function), matching
`ui-settings`' `bindConfig`. Writes are validated before reaching it.
`previewRoot` receives schema CSS variable and data attribute hints. Holding
Peek defaults applies defaults only to the preview and controls; releasing
restores current values without writing the target. Sections are native
collapsible groups. Drawer mode is non-modal; Escape closes it and restores
focus to its opener. Destroy the panel to release subscriptions and controls.

Choice fields use a select; ranges include the existing slider, a number
input and a unit output. The `vector`/`vector3` and `list` controls support
application-defined array types registered through `defineFieldType` of
`ui-settings`; the example demonstrates this without adding schema types.
Paste changes validates a complete diff document before applying it; absent
fields restore defaults. Clipboard failures reveal a selectable text field.
