/** Deterministic activity geometry. Dates use UTC and ongoing ends are explicit. */
import { emphasized } from './mark-options.js';
import { colorScale } from './scales.js';
import { tokenColor } from './tokens.js';

const DAY = 86400000;
const box = (width, height) => ({
  x: 48,
  y: 48,
  width: Math.max(40, width - 72),
  height: Math.max(40, height - 100),
});
const labelShape = (x, y, content) => ({
  tag: 'text',
  attrs: { x, y, fill: 'var(--color-chart-text, #1c1b1f)', 'font-size': 11 },
  content,
});
const year = (time) => new Date(time).getUTCFullYear();
const PATTERNS = ['solid', 'hatched', 'dotted'];

/** Overlay paths distinguish categories even with all colour removed. */
export function patternShapes(rect, pattern) {
  const { x, y, width, height } = rect;
  if (!pattern || pattern === 'solid') {
    return [];
  }
  const shapes = [];
  for (let dx = 3; dx < width; dx += 8) {
    if (pattern === 'dotted') {
      shapes.push({
        tag: 'circle',
        attrs: {
          cx: x + dx,
          cy: y + height / 2,
          r: 1.5,
          fill: 'var(--color-chart-background, #fff)',
        },
      });
    } else {
      shapes.push({
        tag: 'path',
        attrs: {
          d: `M${x + dx},${y + height}l${Math.min(height, width - dx)},-${Math.min(height, width - dx)}`,
          stroke: 'var(--color-chart-background, #fff)',
          'stroke-width': 1.5,
          fill: 'none',
        },
      });
    }
  }
  return shapes;
}

export function compositionLayout(spec, width, height, tokens) {
  const plot = box(width, height);
  plot.height = 28;
  const { theta, color } = spec.encoding;
  const totals = new Map();
  for (const row of spec.data.values) {
    const key = String(row[color.field]);
    totals.set(
      key,
      (totals.get(key) ?? 0) + Math.max(0, Number(row[theta.field]))
    );
  }
  let items = [...totals].map(([name, value]) => ({
    name,
    value,
    emphasis:
      spec.emphasis &&
      spec.data.values.some(
        (row) =>
          String(row[color.field]) === name && emphasized(row[spec.emphasis])
      ),
  }));
  if (spec.topN) {
    items.sort((a, b) => b.value - a.value);
    const tail = items.slice(spec.topN);
    items = items.slice(0, spec.topN);
    if (tail.length) {
      items.push({
        name: 'Other',
        value: tail.reduce((sum, item) => sum + item.value, 0),
        other: true,
        emphasis: tail.some((item) => item.emphasis),
      });
    }
  }
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colors = colorScale(color, spec.data.values, tokens);
  const shapes = [],
    points = [],
    legend = [];
  let cursor = 0;
  items.forEach((item, i) => {
    const share = total ? item.value / total : 0;
    const fill = item.other
      ? tokenColor('color.chart.muted', tokens)
      : colors.color(item.name);
    const segment = {
      x: cursor,
      y: 0,
      width: share * plot.width,
      height: 28,
      fill,
    };
    shapes.push({ tag: 'rect', attrs: segment, row: i });
    if (item.emphasis) {
      shapes.push(labelShape(cursor + segment.width / 2, -6, '★'));
    }
    const text = `${item.name}: ${(share * 100).toFixed(1)}%${item.emphasis ? ' ★ emphasized' : ''}`;
    points.push({
      row: i,
      x: cursor + segment.width / 2,
      y: 0,
      text,
      datum: {
        [color.field]: item.name,
        [theta.field]: item.value,
        percentage: share * 100,
      },
    });
    legend.push({
      label: `${item.name} ${(share * 100).toFixed(1)}%${item.emphasis ? ' ★' : ''}`,
      color: fill,
      x: plot.x,
      y: 100 + i * 24,
    });
    cursor += segment.width;
  });
  return {
    plot,
    axes: [],
    legend,
    series: [{ key: null, color: colors.colorAt(0), shapes, points }],
  };
}

export function calendarLayout(spec, width, height, tokens) {
  const { x, y } = spec.encoding;
  const entries = spec.data.values
    .map((row, i) => ({
      row: i,
      time: Date.parse(row[x.field]),
      value: Number(row[y.field]),
      datum: row,
    }))
    .sort((a, b) => a.time - b.time);
  const startDay = spec.weekStart ?? 0;
  const first = entries[0].time;
  const start =
    first - ((new Date(first).getUTCDay() - startDay + 7) % 7) * DAY;
  const weeks = Math.floor((entries.at(-1).time - start) / (7 * DAY)) + 1;
  const cell = 14;
  const plot = { x: 48, y: 48, width: weeks * cell, height: 7 * cell };
  const values = entries.map((e) => e.value).sort((a, b) => a - b);
  const thresholds =
    spec.thresholds ??
    [0.2, 0.4, 0.6, 0.8].map(
      (q) => values[Math.floor((values.length - 1) * q)]
    );
  const colors = [
    tokenColor('color.chart.grid', tokens),
    '#9cc5e5',
    '#5797cc',
    '#1f6fb2',
    '#164b78',
  ];
  const shapes = [],
    points = [];
  const months = new Set();
  for (const entry of entries) {
    const offset = Math.round((entry.time - start) / DAY);
    const column = Math.floor(offset / 7),
      day = offset % 7;
    const level = thresholds.filter((t) => entry.value > t).length;
    const date = new Date(entry.time).toISOString().slice(0, 10);
    const star =
      spec.emphasis && emphasized(entry.datum[spec.emphasis]) ? ' ★' : '';
    const text = `${date}: ${entry.value}${star}`;
    shapes.push({
      tag: 'rect',
      attrs: {
        x: column * cell,
        y: day * cell,
        width: 11,
        height: 11,
        rx: 2,
        fill: colors[level],
        role: 'img',
        'aria-label': text,
      },
      row: entry.row,
      title: text,
    });
    if (star) {
      shapes.push(labelShape(column * cell, day * cell + 10, '★'));
    }
    points.push({
      row: entry.row,
      x: column * cell + 5.5,
      y: day * cell,
      text,
      day: offset,
      datum: entry.datum,
    });
    const month = date.slice(0, 7);
    if (!months.has(month)) {
      months.add(month);
      shapes.push(
        labelShape(
          column * cell,
          -12,
          new Date(entry.time).toLocaleString('en-US', {
            month: 'short',
            timeZone: 'UTC',
          })
        )
      );
    }
  }
  for (const [weekday, name] of [
    [1, 'Mon'],
    [3, 'Wed'],
    [5, 'Fri'],
  ]) {
    shapes.push(
      labelShape(-32, ((weekday - startDay + 7) % 7) * cell + 9, name)
    );
  }
  const legend = colors.map((color, i) => ({
    label: i === 0 ? 'Less' : i === 4 ? 'More' : String(i + 1),
    color,
    x: 48 + i * 65,
    y: plot.y + plot.height + 28,
  }));
  return {
    width: Math.max(width, plot.width + 72),
    height: Math.max(210, height),
    weeks,
    plot,
    axes: [],
    legend,
    series: [{ key: null, color: colors[3], shapes, points }],
  };
}

export function rangeLayout(spec, width, height, tokens) {
  const { x, x2, y, color } = spec.encoding;
  const rows = spec.data.values;
  const starts = rows.map((row) => Date.parse(row[x.field]));
  // No ambient clock: omitted ongoingEnd extends to the next year after the
  // latest supplied start or closed end. Consumers can inject their snapshot date.
  const latest = Math.max(
    ...starts,
    ...rows.flatMap((row) =>
      row[x2.field] && row[x2.field] !== 'ongoing'
        ? [Date.parse(row[x2.field])]
        : []
    )
  );
  const ongoing = spec.ongoingEnd
    ? Date.parse(spec.ongoingEnd)
    : Date.UTC(year(latest) + 1, 0, 1);
  const ends = rows.map((row) =>
    row[x2.field] && row[x2.field] !== 'ongoing'
      ? Date.parse(row[x2.field])
      : ongoing
  );
  const low = Date.UTC(year(Math.min(...starts)), 0, 1),
    high = Math.max(...ends, low + DAY);
  const plot = box(width, Math.max(height, rows.length * 32 + 110));
  plot.y = 60;
  plot.height -= 12;
  plot.x = Math.min(
    width / 2,
    Math.max(80, ...rows.map((row) => String(row[y.field]).length * 7 + 16))
  );
  plot.width = Math.max(40, width - plot.x - 24);
  const position = (time) => ((time - low) / (high - low)) * plot.width;
  const colors = colorScale(color, rows, tokens);
  const shapes = [],
    points = [];
  rows.forEach((row, i) => {
    const fill = color ? colors.color(row[color.field]) : colors.colorAt(0);
    const pattern = PATTERNS[color ? colors.index(row[color.field]) % 3 : 0];
    const rect = {
      x: position(starts[i]),
      y: i * 32,
      width: Math.max(1, position(ends[i]) - position(starts[i])),
      height: 20,
      fill,
    };
    const end =
      row[x2.field] && row[x2.field] !== 'ongoing' ? row[x2.field] : 'ongoing';
    const star = spec.emphasis && emphasized(row[spec.emphasis]) ? ' ★' : '';
    const text = `${row[y.field]}: ${row[x.field]} – ${end}${color ? `, ${row[color.field]}` : ''}${star}`;
    shapes.push(
      {
        tag: 'rect',
        attrs: { ...rect, tabindex: 0, role: 'img', 'aria-label': text },
        row: i,
        title: text,
        pattern,
      },
      ...patternShapes(rect, pattern),
      {
        ...labelShape(-10, i * 32 + 14, `${row[y.field]}${star}`),
        attrs: {
          ...labelShape(-10, i * 32 + 14, '').attrs,
          'text-anchor': 'end',
        },
      }
    );
    points.push({
      row: i,
      x: rect.x + rect.width / 2,
      y: rect.y,
      text,
      datum: row,
    });
  });
  const ticks = [];
  for (let value = year(low); value <= year(high); value++) {
    ticks.push({
      value: Date.UTC(value, 0, 1),
      position: position(Date.UTC(value, 0, 1)),
      label: String(value),
    });
  }
  return {
    height: Math.max(height, rows.length * 32 + 110),
    plot,
    axes: [{ orient: 'bottom', title: 'Year', ticks, grid: false }],
    legend: colors.domain.map((label, i) => ({
      label,
      color: colors.colorAt(i),
      pattern: PATTERNS[i % 3],
      x: 48 + i * 140,
      y: 38,
    })),
    series: [{ key: null, color: colors.colorAt(0), shapes, points }],
  };
}

export const ACTIVITY_LAYOUTS = {
  calendar: calendarLayout,
  range: rangeLayout,
  composition: compositionLayout,
};
