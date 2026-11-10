/** Value-end rounding and redundant text labels for Cartesian marks. */
export function roundedBar(rect, radius, horizontal, reverse, fill, row) {
  const { x, y, width: w, height: h } = rect;
  const r = Math.min(radius, w / 2, h / 2);
  // Trace from the baseline, rounding the two corners at the value end only.
  let d;
  if (horizontal) {
    d = reverse
      ? `M${x + w},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w}Z`
      : `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  } else {
    d = reverse
      ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
      : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
  }
  return { tag: 'path', attrs: { d, fill }, row };
}

export const emphasized = (value) =>
  value === true || value === 1 || value === 'true' || value === '1';

export function decorateSeries(spec, shapes, points) {
  const horizontal =
    spec.encoding.x.type === 'quantitative' &&
    spec.encoding.y.type !== 'quantitative';
  const field = (horizontal ? spec.encoding.x : spec.encoding.y).field;
  const value = (i) => Number(spec.data.values[points[i].row][field]);
  points.forEach((point, i) => {
    const emphasis =
      spec.emphasis && emphasized(spec.data.values[point.row][spec.emphasis]);
    if (emphasis) {
      point.text += ', ★ emphasized';
    }
    const label =
      spec.labels === 'last'
        ? i === points.length - 1
        : spec.labels === 'peaks' &&
          i > 0 &&
          i < points.length - 1 &&
          value(i) > value(i - 1) &&
          value(i) >= value(i + 1);
    if (label || emphasis) {
      shapes.push({
        tag: 'text',
        attrs: {
          x: point.x,
          y: point.y - 6,
          fill: 'var(--color-chart-text, #1c1b1f)',
          'font-size': 11,
          'text-anchor': 'middle',
        },
        content: `${emphasis ? '★ ' : ''}${label ? value(i) : ''}`,
      });
    }
  });
}

/** Arc marks have no Cartesian value axis; emphasize them with a visible star. */
export function emphasizeArcs(spec, shapes, points) {
  for (const point of points) {
    if (
      spec.emphasis &&
      emphasized(spec.data.values[point.row][spec.emphasis])
    ) {
      point.text += ', ★ emphasized';
      shapes.push({
        tag: 'text',
        attrs: {
          x: point.x,
          y: point.y,
          fill: 'var(--color-chart-text, #1c1b1f)',
          'text-anchor': 'middle',
        },
        content: '★',
      });
    }
  }
}
