/**
 * The marker shapes of a link end, described once as data and drawn by both
 * renderers: as SVG `<marker>` elements (`svgMarkerDefs`) and on a canvas
 * with `Path2D` (`drawMarker`). Each shape is SVG path data in a 100 × 100
 * box; `refX`/`refY` is the point that sits on the end of the line, and the
 * box is drawn with `+x` along the line (SVG `orient="auto"`).
 *
 * One box unit is one stroke width of the line (SVG
 * `markerUnits="strokeWidth"`), so markers grow with the line. The `arrow`
 * and the tick of `bar` are the links-visuals markers (Unlicense).
 *
 * No colour is written here: the colour of an end comes from the tokens.
 */

import { fmt } from './geometry.js';

/**
 * @typedef {object} Marker
 * @property {string} id  the shape name (`arrow`)
 * @property {string} viewBox  always `0 0 100 100`
 * @property {string} path  SVG path data in the box (empty for `none`)
 * @property {number} refX
 * @property {number} refY
 * @property {'stroke'|'fill'} paint  whether the path is stroked or filled
 * @property {number} strokeWidth  in box units (one line width)
 * @property {string} label  how the end is announced
 */

const VIEW_BOX = '0 0 100 100';

/** @type {Readonly<Record<string, Readonly<Marker>>>} */
export const MARKERS = Object.freeze({
  bar: Object.freeze({
    id: 'bar',
    viewBox: VIEW_BOX,
    path: 'M 50 39.27 L 50 60.73',
    refX: 50,
    refY: 50,
    paint: 'stroke',
    strokeWidth: 1,
    label: 'bar',
  }),
  arrow: Object.freeze({
    id: 'arrow',
    viewBox: VIEW_BOX,
    path: 'M 10.35 50.35 L -0.35 39.65 M 10.35 49.65 L -0.35 60.35',
    refX: 10,
    refY: 50,
    paint: 'stroke',
    strokeWidth: 1,
    label: 'arrow',
  }),
  cross: Object.freeze({
    id: 'cross',
    viewBox: VIEW_BOX,
    path: 'M 43 43 L 57 57 M 43 57 L 57 43',
    refX: 50,
    refY: 50,
    paint: 'stroke',
    strokeWidth: 1,
    label: 'cross',
  }),
  dot: Object.freeze({
    id: 'dot',
    viewBox: VIEW_BOX,
    path: 'M 54 50 A 4 4 0 1 1 46 50 A 4 4 0 1 1 54 50 Z',
    refX: 50,
    refY: 50,
    paint: 'fill',
    strokeWidth: 0,
    label: 'dot',
  }),
  none: Object.freeze({
    id: 'none',
    viewBox: VIEW_BOX,
    path: '',
    refX: 50,
    refY: 50,
    paint: 'stroke',
    strokeWidth: 0,
    label: 'no marker',
  }),
});

/** The marker shape names, in a fixed order. */
export const MARKER_IDS = Object.freeze(Object.keys(MARKERS));

/** The markers of a link when none are given. */
export const DEFAULT_ENDS = Object.freeze({ source: 'bar', target: 'arrow' });

/** The box size of every marker (the viewBox is `0 0 100 100`). */
export const MARKER_BOX = 100;

/**
 * The marker of a shape name; an unknown name is `undefined`.
 * @param {string} id
 * @returns {Readonly<Marker>|undefined}
 */
export const getMarker = (id) =>
  Object.hasOwn(MARKERS, id) ? MARKERS[id] : undefined;

/** Text for an XML attribute value. */
export const escapeAttribute = (text) =>
  String(text)
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');

/**
 * The id of the SVG marker of one end of a link.
 * @param {string} prefix  unique per drawing
 * @param {'source'|'target'} end
 * @param {string} shape
 */
export const markerElementId = (prefix, end, shape) =>
  `${prefix}-${end}-${shape}`;

/**
 * SVG `<marker>` elements for the ends of a link. Each end gets its own
 * element, because the two ends can have different colours.
 * @param {Partial<Record<'source'|'target', string>>} ends  shape per end
 * @param {Record<string, string>} colors  `source` and `target` colours
 *   (from `linkColors`)
 * @param {{idPrefix?: string}} [options]
 * @returns {string}  `<marker>` elements (no `<defs>` around them); `none`
 *   and unknown shapes give nothing
 */
export function svgMarkerDefs(ends, colors, { idPrefix = 'link' } = {}) {
  return ['source', 'target']
    .map((end) => {
      const marker = getMarker(ends[end]);
      if (marker === undefined || marker.path === '') {
        return '';
      }
      const color = escapeAttribute(colors[end]);
      const paint =
        marker.paint === 'fill'
          ? `fill="${color}" stroke="none"`
          : `fill="none" stroke="${color}" stroke-width="${fmt(marker.strokeWidth)}" stroke-linecap="butt"`;
      return (
        `<marker id="${escapeAttribute(markerElementId(idPrefix, end, marker.id))}" data-marker="${marker.id}" ` +
        `viewBox="${marker.viewBox}" refX="${fmt(marker.refX)}" refY="${fmt(marker.refY)}" ` +
        `markerWidth="${MARKER_BOX}" markerHeight="${MARKER_BOX}" markerUnits="strokeWidth" ` +
        `orient="auto" overflow="visible"><path d="${marker.path}" ${paint}/></marker>`
      );
    })
    .join('');
}

/**
 * Draw a marker on a canvas: the same path data as the SVG marker, through
 * `Path2D`, placed at `at`, turned by `angle` and scaled by `scale` (canvas
 * units per box unit: the line width, as with `markerUnits="strokeWidth"`).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<Marker>} marker
 * @param {{x: number, y: number}} at
 * @param {number} angle  radians
 * @param {number} scale
 * @param {{color?: string, Path2D?: typeof Path2D}} [options]  without
 *   `color` the current fill or stroke style is kept; `Path2D` defaults to
 *   the global one
 * @returns {boolean}  whether anything was drawn
 */
export function drawMarker(ctx, marker, at, angle, scale, options = {}) {
  if (marker === undefined || marker.path === '') {
    return false;
  }
  const Path = options.Path2D ?? globalThis.Path2D;
  const shape = new Path(marker.path);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-marker.refX, -marker.refY);
  if (marker.paint === 'fill') {
    if (options.color !== undefined) {
      ctx.fillStyle = options.color;
    }
    ctx.fill(shape);
  } else {
    if (options.color !== undefined) {
      ctx.strokeStyle = options.color;
    }
    ctx.lineWidth = marker.strokeWidth;
    ctx.lineCap = 'butt';
    ctx.setLineDash([]);
    ctx.stroke(shape);
  }
  ctx.restore();
  return true;
}
