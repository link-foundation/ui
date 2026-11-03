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

```sh
npm install @link-foundation/ui-components
```

| Entry point                                     | What it has                                                | DOM |
| ----------------------------------------------- | ---------------------------------------------------------- | --- |
| `@link-foundation/ui-components`                | everything below except `./behavior/dom`                   | yes |
| `@link-foundation/ui-components/behavior`       | `parseMachine`, `interpret`, `createActionRegistry`, ...   | no  |
| `@link-foundation/ui-components/behavior/dom`   | `mountBehavior`, `BEHAVIOR_CSS`                            | yes |
| `@link-foundation/ui-components/a11y`           | `trapFocus`, `createRovingTabindex`, `bindKeys`, ...       | yes |
| `@link-foundation/ui-components/charts`         | `parseChart`, `renderChartSvg`, `defineChartElements`, ... | yes |
| `@link-foundation/ui-components/charts/echarts` | `toEChartsOption`, `renderECharts`                         | yes |
| `@link-foundation/ui-components/diagrams`       | `parseDiagram`, `toMermaid`, `defineDiagram`, ...          | yes |
| `@link-foundation/ui-components/links-view`     | `defineLinkView`, `linkGeometry`, `renderLinkSvg`, ...     | yes |

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
(login-flow: diagram
  (kind flowchart)
  (direction down)
  (start: node (label 'Start'))
  (check: node (label 'Signed in?') (shape diamond))
  (home: node (label 'Home'))
  (edge (from start) (to check))
  (edge (from check) (to home) (label 'yes')))
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

The one-line form `(f: diagram (a: node) (b: node))` and the multi-line
form give the same model. `parseDiagram` reads the first diagram of a text,
`diagramsFromLinks` every diagram of a parsed document, and `diagramToLino`
writes a model back: `diagramFromLinks(parse(diagramToLino(model)))` equals
`model`. Every error is a `DiagramError` with a `code` (`no-diagram`,
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
