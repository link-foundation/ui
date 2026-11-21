const MOVES = {
  ArrowRight: (at) => ({ ...at, index: at.index + 1 }),
  ArrowLeft: (at) => ({ ...at, index: at.index - 1 }),
  ArrowDown: (at) => ({ ...at, series: at.series + 1 }),
  ArrowUp: (at) => ({ ...at, series: at.series - 1 }),
  Home: (at) => ({ ...at, index: 0 }),
  End: (at) => ({ ...at, index: Number.MAX_SAFE_INTEGER }),
};

const DAYS = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
const clamp = (value, length) => Math.min(length - 1, Math.max(0, value));

export const navigable = (layout) =>
  layout.series.filter((series) => series.points.length > 0);

export function pointAt(series, at) {
  if (series.length) {
    const s = clamp(at.series, series.length);
    const i = clamp(at.index, series[s].points.length);
    return { series: s, index: i, point: series[s].points[i] };
  }
  return null;
}

export function movePoint(series, active, key, calendar) {
  if (!Object.hasOwn(MOVES, key) || !series.length) {
    return null;
  }
  if (active === null) {
    return pointAt(
      series,
      MOVES[key === 'End' ? 'End' : 'Home']({ series: 0, index: 0 })
    );
  }
  if (calendar && Object.hasOwn(DAYS, key)) {
    const { points } = series[0];
    const index = points.findIndex(
      (point) => point.day === active.point.day + DAYS[key]
    );
    return index === -1 ? active : pointAt(series, { series: 0, index });
  }
  return pointAt(series, MOVES[key](active));
}
