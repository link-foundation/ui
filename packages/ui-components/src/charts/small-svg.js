/**
 * SVG of the small charts: the gauge dial, the sparkline, and the stat
 * tile card (value, change and trend). Deterministic, like the chart SVG.
 */

import { arc as d3Arc, area as d3Area, line as d3Line } from 'd3-shape';
import { scaleBand, scaleLinear } from 'd3-scale';
import { chartLabel, deltaText, withUnit } from './summary.js';
import { el, paint, svgRoot, text } from './svg.js';
import { tokenColor } from './tokens.js';
import { formatNumber } from './values.js';

/**
 * The marks of a sparkline in a box.
 * @param {number[]} values
 * @param {'line'|'area'|'bar'} mark
 * @param {{x: number, y: number, width: number, height: number}} box
 * @param {string} color
 */
export function sparklineMarks(values, mark, box, color) {
  const low = Math.min(0, ...values);
  const high = Math.max(...values, low + 1);
  const y = scaleLinear(
    [mark === 'line' ? Math.min(...values) : low, high],
    [box.y + box.height, box.y]
  );
  if (mark === 'bar') {
    const x = scaleBand(
      values.map((_, i) => i),
      [box.x, box.x + box.width]
    ).padding(0.2);
    return values.map((value, i) =>
      el('rect', {
        x: x(i),
        y: Math.min(y(value), y(0)),
        width: x.bandwidth(),
        height: Math.abs(y(value) - y(0)),
        style: paint('fill', color),
      })
    );
  }
  const x = scaleLinear(
    [0, Math.max(1, values.length - 1)],
    [box.x, box.x + box.width]
  );
  const points = values.map((value, i) => [x(i), y(value)]);
  const line = d3Line().digits(2);
  const marks = [];
  if (mark === 'area') {
    const area = d3Area()
      .y0(box.y + box.height)
      .digits(2);
    marks.push(
      el('path', {
        d: area(points),
        style: `${paint('fill', color)};fill-opacity:0.3`,
      })
    );
  }
  const [lastX, lastY] = points.at(-1);
  marks.push(
    el('path', {
      d: line(points),
      fill: 'none',
      'stroke-width': 1.5,
      style: paint('stroke', color),
    }),
    el('circle', { cx: lastX, cy: lastY, r: 2, style: paint('fill', color) })
  );
  return marks;
}

function sparklineSvg(spec, options) {
  const width = options.width ?? 120;
  const height = options.height ?? 32;
  const color = tokenColor('color.chart.1', options.tokens ?? null);
  return svgRoot(
    {
      width,
      height,
      label: chartLabel(spec),
      title: spec.label,
      className: 'ui-sparkline-svg',
    },
    sparklineMarks(
      spec.values,
      spec.mark,
      { x: 2, y: 3, width: width - 4, height: height - 6 },
      color
    )
  );
}

function gaugeSvg(spec, options) {
  const tokens = options.tokens ?? null;
  const width = options.width ?? 200;
  const height = options.height ?? 132;
  const radius = Math.min(width / 2 - 12, height - 40);
  const cx = width / 2;
  const cy = radius + 12;
  const share = Math.min(
    1,
    Math.max(0, (spec.value - spec.min) / (spec.max - spec.min))
  );
  const start = -Math.PI / 2;
  const arc = d3Arc()
    .innerRadius(radius * 0.72)
    .outerRadius(radius)
    .cornerRadius(2)
    .digits(2);
  const muted = tokenColor('color.chart.muted', tokens);
  const textColor = tokenColor('color.chart.text', tokens);
  return svgRoot(
    {
      width,
      height,
      label: chartLabel(spec),
      title: spec.label,
      className: 'ui-gauge-svg',
    },
    [
      el('g', { transform: `translate(${cx},${cy})`, 'aria-hidden': 'true' }, [
        el('path', {
          d: arc({ startAngle: start, endAngle: Math.PI / 2 }),
          style: paint('fill', tokenColor('color.chart.grid', tokens)),
        }),
        el('path', {
          class: 'ui-gauge-value',
          d: arc({ startAngle: start, endAngle: start + share * Math.PI }),
          style: paint('fill', tokenColor('color.chart.1', tokens)),
        }),
        text(
          {
            x: 0,
            y: -4,
            'text-anchor': 'middle',
            'font-size': 22,
            'font-weight': 600,
            style: paint('fill', textColor),
          },
          withUnit(spec.value, spec.unit)
        ),
        text(
          {
            x: -radius * 0.86,
            y: 16,
            'text-anchor': 'middle',
            'font-size': 11,
            style: paint('fill', muted),
          },
          formatNumber(spec.min)
        ),
        text(
          {
            x: radius * 0.86,
            y: 16,
            'text-anchor': 'middle',
            'font-size': 11,
            style: paint('fill', muted),
          },
          formatNumber(spec.max)
        ),
      ]),
      spec.label
        ? text(
            {
              x: cx,
              y: height - 8,
              'text-anchor': 'middle',
              'font-size': 13,
              style: paint('fill', textColor),
              'aria-hidden': 'true',
            },
            spec.label
          )
        : '',
    ]
  );
}

const ARROWS = { up: '▲', down: '▼', unchanged: '■' };

/** The arrow of a change: ▲ up, ▼ down, ■ unchanged. */
export const deltaArrow = (delta) => {
  if (delta > 0) {
    return ARROWS.up;
  }
  return delta < 0 ? ARROWS.down : ARROWS.unchanged;
};

function statTileSvg(spec, options) {
  const tokens = options.tokens ?? null;
  const width = options.width ?? 220;
  const height = options.height ?? 104;
  const textColor = tokenColor('color.chart.text', tokens);
  const muted = tokenColor('color.chart.muted', tokens);
  const children = [
    text(
      { x: 12, y: 22, 'font-size': 13, style: paint('fill', muted) },
      spec.label ?? ''
    ),
    text(
      {
        x: 12,
        y: 52,
        'font-size': 26,
        'font-weight': 600,
        style: paint('fill', textColor),
      },
      withUnit(spec.value, spec.unit)
    ),
  ];
  if (spec.delta !== null) {
    children.push(
      text(
        { x: 12, y: 76, 'font-size': 13, style: paint('fill', textColor) },
        `${deltaArrow(spec.delta)} ${deltaText(spec.delta)}`
      )
    );
  }
  if (spec.trend.length > 1) {
    children.push(
      ...sparklineMarks(
        spec.trend,
        'line',
        { x: width - 92, y: 62, width: 80, height: 28 },
        tokenColor('color.chart.1', tokens)
      )
    );
  }
  return svgRoot(
    {
      width,
      height,
      label: chartLabel(spec),
      title: spec.label,
      className: 'ui-stat-tile-svg',
    },
    [el('g', { 'aria-hidden': 'true' }, children)]
  );
}

const RENDERERS = {
  gauge: gaugeSvg,
  'stat-tile': statTileSvg,
  sparkline: sparklineSvg,
};

/**
 * A small chart spec as an SVG string.
 * @param {import('./small-model.js').SmallChartSpec} spec
 * @param {{width?: number, height?: number, tokens?: Record<string, string>|Map<string, string>|null}} [options]
 */
export const renderSmallChartSvg = (spec, options = {}) =>
  RENDERERS[spec.kind](spec, options);
