/**
 * `renderLinkSvg(geometry, style)`: one link as SVG text. The output only
 * depends on the arguments (numbers are rounded, attributes are written in
 * a fixed order), so two calls give the same string. The marker shapes come
 * from `markers.js`, as for the Canvas renderer.
 */

import { fmt, pathToSvgD } from './geometry.js';
import {
  escapeAttribute,
  getMarker,
  markerElementId,
  svgMarkerDefs,
} from './markers.js';
import { buildScene } from './scene.js';

/** The SVG path data of a list of line segments. */
const segmentsD = (segments) =>
  segments
    .map((s) => `M ${fmt(s.x1)} ${fmt(s.y1)} L ${fmt(s.x2)} ${fmt(s.y2)}`)
    .join(' ');

const attr = (value) => escapeAttribute(value);

function gridSvg(grid) {
  if (grid === null) {
    return '';
  }
  const part = (segments, color, width, name) =>
    segments.length === 0
      ? ''
      : `<path data-part="grid-${name}" d="${segmentsD(segments)}" fill="none" stroke="${attr(color)}" stroke-width="${fmt(width)}"/>`;
  return [
    part(grid.minor, grid.minorColor, grid.minorWidth, 'minor'),
    part(grid.major, grid.majorColor, grid.majorWidth, 'major'),
  ].join('');
}

function blueprintSvg(blueprint) {
  if (blueprint === null) {
    return '';
  }
  const dash = blueprint.dash.join(' ');
  const guide = blueprint.guide.points
    .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
    .join(' ');
  const circles = blueprint.points
    .map(
      (p) =>
        `<circle data-role="${p.role}" cx="${fmt(p.at.x)}" cy="${fmt(p.at.y)}" r="${fmt(blueprint.radius)}" fill="none" stroke="${attr(p.color)}" stroke-width="${fmt(blueprint.strokeWidth)}" stroke-dasharray="${dash}"/>`
    )
    .join('');
  return (
    `<g data-part="blueprint"><polyline data-part="guide" points="${guide}" fill="none" ` +
    `stroke="${attr(blueprint.guide.color)}" stroke-width="${fmt(blueprint.guide.width)}" stroke-dasharray="${dash}"/>${circles}</g>`
  );
}

/** The `marker-start`/`marker-end` attributes of the line. */
function markerAttributes(ends, prefix) {
  return ends
    .map(({ end, shape }) => {
      const marker = getMarker(shape);
      if (marker === undefined || marker.path === '') {
        return '';
      }
      const name = end === 'source' ? 'marker-start' : 'marker-end';
      return ` ${name}="url(#${attr(markerElementId(prefix, end, marker.id))})"`;
    })
    .join('');
}

/**
 * The marker shape ids a scene draws (in source, target order), the same
 * list `drawLinkCanvas` returns.
 * @param {ReturnType<typeof buildScene>} scene
 * @returns {string[]}
 */
export const drawnMarkers = (scene) =>
  scene.ends
    .map(({ shape }) => getMarker(shape))
    .filter((m) => m !== undefined && m.path !== '')
    .map((m) => m.id);

/**
 * One link as an SVG document fragment (`<svg>…</svg>`).
 * @param {import('./geometry.js').LinkGeometry} geometry
 * @param {import('./scene.js').LinkStyle} style
 * @returns {string}
 */
export function renderLinkSvg(geometry, style) {
  const scene = buildScene(geometry, style);
  const prefix = style.idPrefix ?? 'link';
  const { width, height, view } = scene;
  const ends = Object.fromEntries(scene.ends.map((e) => [e.end, e.shape]));
  const colors = Object.fromEntries(scene.ends.map((e) => [e.end, e.color]));
  const used = drawnMarkers(scene).join(' ');
  const line = [
    `<path data-part="line" d="${pathToSvgD(scene.line.path)}" fill="none"`,
    `stroke="${attr(scene.line.color)}" stroke-width="${fmt(scene.line.width)}"`,
    `stroke-linecap="butt" stroke-linejoin="round"${markerAttributes(scene.ends, prefix)}/>`,
  ].join(' ');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}"`,
    `viewBox="0 0 ${fmt(width)} ${fmt(height)}" aria-hidden="true" focusable="false"`,
    `data-markers="${used}">`,
  ].join(' ');
  return [
    svg,
    `<defs>${svgMarkerDefs(ends, colors, { idPrefix: prefix })}</defs>`,
    `<rect data-part="background" width="${fmt(width)}" height="${fmt(height)}" fill="${attr(scene.background)}"/>`,
    `<g data-part="view" transform="translate(${fmt(view.x, 4)} ${fmt(view.y, 4)}) scale(${fmt(view.k, 6)})">`,
    gridSvg(scene.grid),
    line,
    blueprintSvg(scene.blueprint),
    '</g></svg>',
  ].join('');
}
