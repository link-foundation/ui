/**
 * The optional ECharts renderer of the chart dialect, for `(renderer
 * echarts)`.
 *
 * `toEChartsOption(spec)` is pure: it turns a chart spec into an ECharts
 * option object (no functions, so it is plain data and can be compared in
 * tests). `renderECharts` loads ECharts with a dynamic `import('echarts')`
 * only when called, so ECharts (an optional peer dependency) is never part
 * of a page that does not use `(renderer echarts)`.
 *
 * The series and their data follow the order of `layoutChart`, so the
 * keyboard points of `<ui-chart>` map to `(seriesIndex, dataIndex)`.
 */

import { layoutChart } from './layout.js';
import {
  continuousValue,
  discreteDomain,
  fieldTitle,
  isDiscrete,
  sizeScale,
} from './scales.js';
import { chartLabel } from './summary.js';
import { CHART_TOKENS, SERIES_COUNT, seriesToken } from './tokens.js';

/** The ECharts axis type of a field. */
function axisType(def) {
  if (isDiscrete(def)) {
    return 'category';
  }
  return def.type === 'temporal' ? 'time' : 'value';
}

/** An axis option of a field. */
function axisOption(def, rows, colors, zero) {
  const type = axisType(def);
  return {
    type,
    name: fieldTitle(def),
    nameLocation: 'middle',
    nameGap: 32,
    ...(type === 'category' ? { data: discreteDomain(def, rows) } : {}),
    ...(type === 'value' ? { scale: !zero } : {}),
    axisLine: { lineStyle: { color: colors.axis } },
    axisLabel: { color: colors.muted },
    nameTextStyle: { color: colors.text },
    splitLine: { lineStyle: { color: colors.grid } },
  };
}

/** The value of a field on an ECharts axis. */
const axisValue = (def, value) =>
  isDiscrete(def) ? String(value) : continuousValue(def, value);

const SERIES_TYPES = {
  line: 'line',
  area: 'line',
  bar: 'bar',
  point: 'scatter',
};

/** The style options of a mark. */
function markOptions(spec, stacked) {
  const { mark } = spec;
  return {
    ...(mark.type === 'area' ? { areaStyle: { opacity: 0.35 } } : {}),
    ...(mark.type === 'line' || mark.type === 'area'
      ? {
          showSymbol: mark.point,
          smooth: mark.interpolate === 'monotone',
          ...(mark.interpolate === 'step' ? { step: 'end' } : {}),
        }
      : {}),
    ...(stacked ? { stack: 'total' } : {}),
  };
}

function cartesianSeries(spec, layout, colors) {
  const { x, y, size } = spec.encoding;
  const rows = spec.data.values;
  const radius = sizeScale(size, rows);
  const stacked =
    (spec.mark.type === 'bar' || spec.mark.type === 'area') &&
    spec.encoding.color !== undefined;
  return layout.series.map((series, s) => ({
    type: SERIES_TYPES[spec.mark.type],
    name: series.key ?? fieldTitle(y),
    itemStyle: { color: colors.series[s % SERIES_COUNT] },
    ...markOptions(spec, stacked),
    data: series.points.map((point) => {
      const row = rows[point.row];
      return {
        name: point.text,
        value: [axisValue(x, row[x.field]), axisValue(y, row[y.field])],
        ...(size === undefined
          ? {}
          : { symbolSize: Math.round(radius(row[size.field]) * 2) }),
      };
    }),
  }));
}

function arcSeries(spec, layout, colors) {
  const { theta, color } = spec.encoding;
  const rows = spec.data.values;
  const domain = color === undefined ? [] : discreteDomain(color, rows);
  const radius = Math.min(layout.plot.width, layout.plot.height) / 2;
  return [
    {
      type: 'pie',
      name: fieldTitle(theta),
      radius: [spec.mark.innerRadius, Math.round(radius)],
      label: { color: colors.text },
      data: layout.series[0].points.map((point, i) => {
        const row = rows[point.row];
        const index =
          color === undefined
            ? i
            : Math.max(0, domain.indexOf(String(row[color.field])));
        return {
          name: color === undefined ? point.text : String(row[color.field]),
          value: Number(row[theta.field]),
          tooltip: { formatter: point.text },
          itemStyle: { color: colors.series[index % SERIES_COUNT] },
        };
      }),
    },
  ];
}

/** The colours of a mode as literal values (ECharts cannot read CSS vars). */
function modeColors(theme) {
  const tokens = CHART_TOKENS[theme] ?? CHART_TOKENS.light;
  return {
    series: Array.from(
      { length: SERIES_COUNT },
      (_, i) => tokens[seriesToken(i)]
    ),
    background: tokens['color.chart.background'],
    text: tokens['color.chart.text'],
    muted: tokens['color.chart.muted'],
    axis: tokens['color.chart.axis'],
    grid: tokens['color.chart.grid'],
  };
}

/**
 * The ECharts option of a chart spec: pure and deterministic.
 * @param {import('./chart-model.js').ChartSpec} spec
 * @param {{theme?: 'light'|'dark', width?: number, height?: number}} [options]
 * @returns {object}
 */
export function toEChartsOption(spec, options = {}) {
  if (spec.kind !== 'chart') {
    throw new TypeError(`ECharts renders (chart ...) links, not ${spec.kind}`);
  }
  const colors = modeColors(options.theme ?? 'light');
  const layout = layoutChart(spec, options);
  const arc = spec.mark.type === 'arc';
  const legend =
    spec.encoding.color === undefined
      ? {}
      : {
          legend: {
            top: spec.title ? 28 : 4,
            textStyle: { color: colors.text },
          },
        };
  const option = {
    animation: false,
    backgroundColor: colors.background,
    color: colors.series,
    textStyle: { color: colors.text },
    aria: { enabled: true, label: { description: chartLabel(spec) } },
    ...(spec.title
      ? { title: { text: spec.title, textStyle: { color: colors.text } } }
      : {}),
    tooltip: { trigger: 'item', formatter: '{b}' },
    ...legend,
    series: arc
      ? arcSeries(spec, layout, colors)
      : cartesianSeries(spec, layout, colors),
  };
  if (!arc) {
    const filled = spec.mark.type === 'bar' || spec.mark.type === 'area';
    const horizontal = spec.mark.type === 'bar' && isDiscrete(spec.encoding.y);
    const rows = spec.data.values;
    option.grid = {
      left: layout.plot.x,
      top: layout.plot.y,
      width: layout.plot.width,
      height: layout.plot.height,
    };
    option.xAxis = axisOption(
      spec.encoding.x,
      rows,
      colors,
      filled && horizontal
    );
    option.yAxis = axisOption(
      spec.encoding.y,
      rows,
      colors,
      filled && !horizontal
    );
  }
  return option;
}

/**
 * Render a chart spec with ECharts into a container, loading ECharts on
 * first use.
 * @param {HTMLElement} container  sized to the chart
 * @param {import('./chart-model.js').ChartSpec} spec
 * @param {object} [options]
 * @param {() => Promise<object>} [options.loadECharts]  default `import('echarts')`
 * @param {'light'|'dark'} [options.theme]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @returns {Promise<{instance: object, option: object}>}
 */
export async function renderECharts(container, spec, options = {}) {
  const load = options.loadECharts ?? (() => import('echarts'));
  const module = await load();
  const echarts = module.init === undefined ? module.default : module;
  const option = toEChartsOption(spec, options);
  const instance = echarts.init(container, null, {
    renderer: 'svg',
    width: options.width ?? spec.width ?? undefined,
    height: options.height ?? spec.height ?? undefined,
  });
  instance.setOption(option);
  return { instance, option };
}
