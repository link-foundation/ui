# Activity charts

Serve `packages/ui-components/examples/activity-charts.html` with
`node scripts/serve-static.mjs` from the repository root. The gallery reads
[activity-charts.lino](../../examples/activity-charts.lino); data fetching and
consumer text stay with the application.

All options round-trip through `parseChart` / `chartToLino`. Object properties
use camelCase; LiNo uses kebab-case. Assign objects to `uiChart.spec`. The
`tooltip.content` callback stays in memory; serialization writes only its layer.

| Object option                               | LiNo                                               | Behavior                                                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encoding.y.scale: {type: 'log', base: 10}` | `scale` with `type log`, `base 10` under the field | Positive powers are ticks. Nonpositive values clamp to the positive domain minimum; `layoutChart().diagnostics` and the element's `chart-diagnostic` event report each row. Original values remain in the table and tooltip. |
| `cornerRadius: 4`                           | `corner-radius 4`                                  | Round the two corners at the value end of vertical or horizontal bars, including negative values.                                                                                                                            |
| `labels: 'peaks'` or `'last'`               | `labels peaks` or `labels last`                    | Label interior local maxima or the final point of each Cartesian series.                                                                                                                                                     |
| `emphasis: 'favourite'`                     | `emphasis favourite`                               | Values `true`, `1`, `'true'`, `'1'` add a star and accessible emphasis text.                                                                                                                                                 |
| `topN: 5`                                   | `top-n 5`                                          | Composition retains five largest categories and aggregates the remainder as muted Other, last. Shares use the total including Other.                                                                                         |
| `weekStart: 1`                              | `week-start 1`                                     | Calendar weekday origin, 0 Sunday through 6 Saturday; default Sunday.                                                                                                                                                        |
| `thresholds: [1,3,5,7]`                     | `thresholds 1 3 5 7`                               | Four increasing boundaries produce five calendar levels; omitted boundaries use data quantiles.                                                                                                                              |
| `ongoingEnd: '2026-01-01'`                  | `ongoing-end 2026-01-01`                           | Timeline snapshot date for absent or `ongoing` ends. Default is January 1 of the year after the latest supplied date, keeping rendering deterministic.                                                                       |

A calendar encodes `x` as a temporal date and `y` as a quantitative value. It
lays out supplied days in UTC week columns and weekday rows, with month labels,
Mon/Wed/Fri labels and a Less–More legend. A full year such as 2025 spans 53
columns (alignment can require 54 for a leap year). The scroll region opens at
the newest week. Up/Down move one day, Left/Right one week when that day exists;
Home/End reach the first/last supplied day. The table retains every supplied day.

A range encodes temporal `x` (start), temporal `x2` (end), nominal `y` (row name)
and optional `color` (category). End fields can be omitted or contain `ongoing`.
Ends before starts are rejected. Solid, hatched and dotted patterns cycle with
categories in both bars and legend. Tab focuses bars; arrows and Home/End
navigate and announce rows. A composition uses quantitative `theta` and nominal
`color`, aggregates repeated categories and draws one horizontal 100% bar with a
name/percentage legend. Tables retain original rows rather than aggregated ones.

```js
chart.spec = {
  ...spec,
  tooltip: {
    layer: 'top',
    content: (datum) => ({
      title: datum.name,
      value: datum.count,
      rows: [['Source', 'Snapshot']],
    }),
  },
};
```

Top tooltips use the shared `positionFloating` helper and a manual popover,
escaping `overflow` and `clip-path` ancestors. They anchor to the pointer or the
keyboard mark's top centre, and prefer the left side in the rightmost 40% of
the plot. Viewport collision handling still applies. Escape, blur, rerender and
disconnection dismiss the tooltip and release positioning listeners. Content is
rendered as text, including callback values. `layer: 'inline'` retains the inline
layer. Existing charts without tooltip configuration retain plain text tooltips.

A `tag-cloud` has `label`, `min-size` (default 12), `max-size` (default 36) and
`items` containing `item NAME` with optional `count`, `color` and `emphasis true`.
Object items use `{name, count, color, emphasis}`. Sizes interpolate with
`log(1 + count)` relative to the largest count; missing/zero counts use the
minimum. DOM output is a semantic list with counts in accessible names and stars
for emphasized items. SVG export keeps a title for each item.

A stat tile accepts `notation compact`, `compact-threshold 10000`, `hint TEXT`
and `footnote` with `label` and `href`. Object options are `notation`,
`compactThreshold`, `hint`, `footnote: {label, href}`. Compact formatting starts
at the absolute threshold using English short notation, so 123456 becomes 123K;
the exact value stays in the SVG title, accessible name and table. The footnote
is a real keyboard-focusable link. HTTP(S), mailto, root-relative and fragment
links are accepted.

These extensions use SVG even when `renderer: 'echarts'` is requested, preserving
the same geometry, tooltips and keyboard behavior. The standalone ECharts adapter
rejects extended specs with an explicit error; original chart specs keep their
existing optional ECharts renderer.
