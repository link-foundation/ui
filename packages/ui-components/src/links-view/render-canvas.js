/**
 * `drawLinkCanvas(ctx, geometry, style)`: one link on a 2D canvas, the same
 * scene as `renderLinkSvg` draws. The marker shapes come from `markers.js`
 * (`drawMarker` turns the same path data into a `Path2D`).
 */

import { drawMarker, getMarker } from './markers.js';
import { buildScene } from './scene.js';

function strokeSegments(ctx, segments, color, width) {
  if (segments.length === 0) {
    return;
  }
  ctx.beginPath();
  for (const s of segments) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawPath(ctx, path) {
  ctx.beginPath();
  if (path.length === 0) {
    return;
  }
  ctx.moveTo(path[0].p0.x, path[0].p0.y);
  for (const s of path) {
    ctx.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p3.x, s.p3.y);
  }
}

function drawBlueprint(ctx, blueprint) {
  ctx.setLineDash([...blueprint.dash]);
  const { points, color, width } = blueprint.guide;
  ctx.beginPath();
  points.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  for (const p of blueprint.points) {
    ctx.beginPath();
    // SVG starts a circle's dashes at its rightmost point, going clockwise
    // (y down); so does a canvas arc from angle 0.
    ctx.arc(p.at.x, p.at.y, blueprint.radius, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = blueprint.strokeWidth;
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/**
 * Draw one link. The canvas is cleared to the background first.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./geometry.js').LinkGeometry} geometry
 * @param {import('./scene.js').LinkStyle & {Path2D?: typeof Path2D}} style
 * @returns {{markers: string[]}}  the marker shape ids drawn (source,
 *   target), as `drawnMarkers` lists them for SVG
 */
export function drawLinkCanvas(ctx, geometry, style) {
  const scene = buildScene(geometry, style);
  const ratio = style.pixelRatio ?? 1;
  const { view } = scene;
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.transform(view.k, 0, 0, view.k, view.x, view.y);
  ctx.setLineDash([]);
  if (scene.grid !== null) {
    const g = scene.grid;
    strokeSegments(ctx, g.minor, g.minorColor, g.minorWidth);
    strokeSegments(ctx, g.major, g.majorColor, g.majorWidth);
  }
  drawPath(ctx, scene.line.path);
  ctx.strokeStyle = scene.line.color;
  ctx.lineWidth = scene.line.width;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  ctx.stroke();
  const markers = [];
  for (const end of scene.ends) {
    const marker = getMarker(end.shape);
    const drawn = drawMarker(ctx, marker, end.at, end.angle, scene.line.width, {
      color: end.color,
      Path2D: style.Path2D,
    });
    if (drawn) {
      markers.push(marker.id);
    }
  }
  if (scene.blueprint !== null) {
    drawBlueprint(ctx, scene.blueprint);
  }
  ctx.restore();
  return { markers };
}
