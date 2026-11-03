/**
 * Charts of the associative UI framework: the chart dialect (a Vega-Lite
 * style `data`, `mark`, `encoding` written in Links Notation), its
 * deterministic SVG renderer, the chart colour tokens and the custom
 * elements `<ui-chart>`, `<ui-stat-tile>`, `<ui-gauge>` and
 * `<ui-sparkline>`.
 *
 * The ECharts adapter is a separate entry
 * (`@link-foundation/ui-components/charts/echarts`); `<ui-chart>` loads it
 * only for `(renderer echarts)`.
 */

import { defineChartElement } from './chart.js';
import { defineGaugeElement } from './gauge.js';
import { defineSparklineElement } from './sparkline.js';
import { defineStatTileElement } from './stat-tile.js';

export {
  CHANNELS,
  CHART_KINDS,
  ChartSpecError,
  FIELD_TYPES,
  MARKS,
  RENDERERS,
  chartFromLinks,
  chartToLino,
  chartsFromLinks,
  parseChart,
} from './chart-model.js';
export { SMALL_KINDS, SPARKLINE_MARKS } from './small-model.js';
export { DEFAULT_HEIGHT, DEFAULT_WIDTH, layoutChart } from './layout.js';
export { renderChartSvg } from './svg-renderer.js';
export { chartLabel, chartTable, summarizeChart } from './summary.js';
export {
  CHART_CSS,
  CHART_TOKENS,
  SERIES_COUNT,
  chartTokensLino,
  seriesToken,
  tokenColor,
} from './tokens.js';
export { CHART_TAG, createChartClass, defineChartElement } from './chart.js';
export { GAUGE_TAG, defineGaugeElement } from './gauge.js';
export { SPARKLINE_TAG, defineSparklineElement } from './sparkline.js';
export { STAT_TILE_TAG, defineStatTileElement } from './stat-tile.js';
export { LINO_SCRIPT_TYPE, ensureChartStyles } from './element.js';

/**
 * Define every chart element in a window (each once).
 * @param {Window} [win]
 */
export function defineChartElements(win = globalThis.window) {
  return {
    chart: defineChartElement(win),
    statTile: defineStatTileElement(win),
    gauge: defineGaugeElement(win),
    sparkline: defineSparklineElement(win),
  };
}
