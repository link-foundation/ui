# @link-foundation/ui-components

Components of the associative UI framework, written in Links Notation. The
first family is charts. You describe a chart with the grammar of
[Vega-Lite](https://vega.github.io/vega-lite/): `data`, `mark` and
`encoding`. The package checks it, writes it back as Links Notation, and
renders it as an SVG. The SVG is the same for the same spec every time.

The `<ui-chart>` element shows that SVG with an accessible name, a data
table twin and keyboard navigation between the points. `<ui-stat-tile>`,
`<ui-gauge>` and `<ui-sparkline>` are smaller charts.

The runtime dependencies are `links-notation` (the parser),
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

## Grammar

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

### Errors

`chartFromLinks` and `parseChart` throw a `ChartSpecError` for a bad spec.
It has a `code`, a `reason`, the `path` of the link (the index of each link
from the top) and the `link` itself, written back as Links Notation. The
message ends with the position, for example `(at link 1 > 3: (mark pie))`.
Among the codes are `unknown-mark`, `unknown-type`, `missing-field`,
`missing-mark`, `invalid-data`, `invalid-value`, `empty-data` and
`duplicate-property`.

## API

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

## Accessibility

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

## Tokens

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

## ECharts

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
