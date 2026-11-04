/** Zoom is CSS pixels per millisecond; scroll is CSS pixels. */
export const timeToX = (ms, { zoom = 0.2, scroll = 0 } = {}) =>
  ms * zoom - scroll;
export const xToTime = (x, { zoom = 0.2, scroll = 0 } = {}) =>
  (x + scroll) / zoom;
export function snapTime(
  ms,
  { fps = 60, candidates = [], threshold = 8 } = {}
) {
  const grid = (Math.round((ms * fps) / 1000) * 1000) / fps;
  const nearest = [...candidates, grid].reduce(
    (best, time) => (Math.abs(time - ms) < Math.abs(best - ms) ? time : best),
    Infinity
  );
  return Math.abs(nearest - ms) <= threshold ? nearest : ms;
}
