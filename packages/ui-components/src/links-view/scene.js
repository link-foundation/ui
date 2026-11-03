/**
 * What a link view draws, worked out once for both renderers: the view
 * transform, the grid lines in the visible area, the line, the two marker
 * ends and the blueprint points. The SVG and the Canvas renderer each turn
 * the same scene into their own output, so they draw the same picture.
 *
 * Sizes follow links-visuals: the line is 0.085 of the grid step wide, the
 * blueprint circles have a radius of 0.17 of the grid step, and the grid has
 * a major line every step and a minor line every half step.
 */

import { endAngles, pathBounds } from './geometry.js';

/** The grid step in world units. */
export const GRID_SPACING = 20;

/** The line width as a fraction of the grid step (links-visuals). */
export const STROKE_FRACTION = 0.085;

/** The blueprint circle radius as a fraction of the grid step. */
export const RADIUS_FRACTION = 0.17;

/** The dash pattern of the blueprint circles and guide (world units). */
export const BLUEPRINT_DASH = Object.freeze([4, 2]);

/** Grid lines closer than this on screen (pixels) are left out. */
const MIN_GRID_PIXELS = 4;

/** The most grid lines drawn in one direction. */
const MAX_GRID_LINES = 4000;

/**
 * @typedef {{x: number, y: number, k: number}} View  screen = world · k +
 *   (x, y)
 * @typedef {{x1: number, y1: number, x2: number, y2: number}} Segment
 * @typedef {object} LinkStyle
 * @property {number} width  in CSS pixels
 * @property {number} height
 * @property {View} [view]  default: identity
 * @property {Readonly<Record<string, string>>} colors  from `linkColors`
 * @property {{source?: string, target?: string}} [ends]  marker shapes
 * @property {boolean} [blueprint]
 * @property {boolean} [grid]
 * @property {number} [gridSpacing]
 * @property {number} [lineWidth]  world units (default from the grid step)
 * @property {string} [idPrefix]  makes the SVG marker ids unique
 * @property {number} [pixelRatio]  canvas pixels per CSS pixel
 */

/** The lines of one grid direction inside [min, max]. */
function gridValues(min, max, step) {
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  const values = [];
  for (let i = first; i <= last && values.length < MAX_GRID_LINES; i += 1) {
    values.push(i);
  }
  return values;
}

/**
 * The grid lines in the visible world rectangle: major lines every step,
 * minor lines every half step in between.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} area
 * @param {number} spacing
 * @param {number} k  the zoom, to drop lines that would be too dense
 * @returns {{minor: Segment[], major: Segment[]}}
 */
export function gridLines(area, spacing, k) {
  const half = spacing / 2;
  const minor = [];
  const major = [];
  if (half * k < MIN_GRID_PIXELS && spacing * k < MIN_GRID_PIXELS) {
    return { minor, major };
  }
  const withMinor = half * k >= MIN_GRID_PIXELS;
  for (const i of gridValues(area.minX, area.maxX, half)) {
    const x = i * half;
    const list = i % 2 === 0 ? major : minor;
    if (list === major || withMinor) {
      list.push({ x1: x, y1: area.minY, x2: x, y2: area.maxY });
    }
  }
  for (const i of gridValues(area.minY, area.maxY, half)) {
    const y = i * half;
    const list = i % 2 === 0 ? major : minor;
    if (list === major || withMinor) {
      list.push({ x1: area.minX, y1: y, x2: area.maxX, y2: y });
    }
  }
  return { minor, major };
}

/** The world rectangle a view shows in a `width × height` viewport. */
export function visibleArea(view, width, height) {
  return {
    minX: -view.x / view.k,
    minY: -view.y / view.k,
    maxX: (width - view.x) / view.k,
    maxY: (height - view.y) / view.k,
  };
}

/** The colour of each blueprint point (links-visuals roles). */
function pointColor(index, count, colors) {
  if (index === 0) {
    return colors.blueprintStart;
  }
  if (index === count - 1) {
    return colors.blueprintEnd;
  }
  if (index === (count - 1) / 2) {
    return colors.blueprintCenter;
  }
  return colors.blueprintPoint;
}

/** The role of each blueprint point, for tests and data attributes. */
function pointRole(index, count) {
  if (index === 0) {
    return 'start';
  }
  if (index === count - 1) {
    return 'end';
  }
  return index === (count - 1) / 2 ? 'center' : 'point';
}

/**
 * The scene of one link.
 * @param {import('./geometry.js').LinkGeometry} geometry
 * @param {LinkStyle} style
 */
export function buildScene(geometry, style) {
  const spacing = style.gridSpacing ?? GRID_SPACING;
  const view = style.view ?? { x: 0, y: 0, k: 1 };
  const colors = style.colors;
  const lineWidth = style.lineWidth ?? STROKE_FRACTION * spacing;
  const angles = endAngles(geometry.path);
  const ends = { source: 'bar', target: 'arrow', ...style.ends };
  const count = geometry.points.length;
  return {
    width: style.width,
    height: style.height,
    view,
    background: colors.background,
    grid:
      style.grid === true
        ? {
            ...gridLines(
              visibleArea(view, style.width, style.height),
              spacing,
              view.k
            ),
            minorColor: colors.gridMinor,
            majorColor: colors.gridMajor,
            minorWidth: 0.5,
            majorWidth: 1,
          }
        : null,
    line: { path: geometry.path, width: lineWidth, color: colors.line },
    ends: [
      {
        end: 'source',
        shape: ends.source,
        at: geometry.path[0]?.p0 ?? geometry.source,
        angle: angles.start,
        color: colors.source,
      },
      {
        end: 'target',
        shape: ends.target,
        at: geometry.path.at(-1)?.p3 ?? geometry.target,
        angle: angles.end,
        color: colors.target,
      },
    ],
    blueprint:
      style.blueprint === true
        ? {
            radius: RADIUS_FRACTION * spacing,
            strokeWidth: 1,
            dash: BLUEPRINT_DASH,
            guide: {
              points: geometry.points,
              color: colors.blueprintGuide,
              width: 0.5,
            },
            points: geometry.points.map((at, i) => ({
              at,
              role: pointRole(i, count),
              color: pointColor(i, count, colors),
            })),
          }
        : null,
  };
}

/**
 * The world bounds of what a link draws, with room for its markers and
 * blueprint circles.
 * @param {import('./geometry.js').LinkGeometry} geometry
 * @param {{gridSpacing?: number}} [options]
 */
export function sceneBounds(geometry, { gridSpacing = GRID_SPACING } = {}) {
  const b = pathBounds(geometry.path);
  const pad = gridSpacing * 1.5;
  return {
    minX: b.minX - pad,
    minY: b.minY - pad,
    maxX: b.maxX + pad,
    maxY: b.maxY + pad,
  };
}

/**
 * The view that fits world bounds into a viewport, centred.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bounds
 * @param {number} width
 * @param {number} height
 * @param {{min?: number, max?: number}} [limits]  zoom limits
 * @returns {View}
 */
export function fitView(bounds, width, height, { min = 0.1, max = 20 } = {}) {
  const bw = Math.max(1e-9, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-9, bounds.maxY - bounds.minY);
  const k = Math.min(max, Math.max(min, Math.min(width / bw, height / bh)));
  return {
    x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * k,
    y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * k,
    k,
  };
}
