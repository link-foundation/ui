import { linkGeometry, pathToSvgD, endAngles } from './geometry.js';
import {
  escapeAttribute,
  svgMarkerDefs,
  markerElementId,
  drawMarker,
  getMarker,
} from './markers.js';
import { visibleLabels } from './labels.js';
import { networkNeighbours } from './network-model.js';

/**
 * Two shared geometry curves meet at the allocated centre anchor. This works
 * for references to links even in cyclic networks: no recursive resolution.
 */
export function networkGeometry(link, positions) {
  const center = positions.get(link.id) ?? { x: 0, y: 0 };
  const source = positions.get(link.source) ?? {
    x: center.x - 24,
    y: center.y - 12,
  };
  const target = positions.get(link.target) ?? {
    x: center.x + 24,
    y: center.y + 12,
  };
  const loop = (a, b) => a.x === b.x && a.y === b.y;
  const first = linkGeometry({
    source,
    target: center,
    selfLoop: loop(source, center),
    loopRadius: 16,
  });
  const last = linkGeometry({
    source: center,
    target,
    selfLoop: loop(center, target),
    loopRadius: 16,
  });
  // A self-reference loop from #41 starts and finishes at its source anchor.
  return {
    source,
    target,
    center,
    path: [...first.path, ...last.path],
    points: [...first.points, ...last.points],
  };
}

/** Static geometry is cached by the element; pan/zoom reuses the same paths. */
export function networkShapes(
  network,
  positions,
  style = 'glyph',
  previous = new Map()
) {
  const shapes = new Map();
  for (const link of network.links.values()) {
    const old = previous.get(link.id);
    if (
      old &&
      old.style === style &&
      old.sourceId === link.source &&
      old.targetId === link.target &&
      old.geometry.center === positions.get(link.id) &&
      (link.source === 0 ||
        old.geometry.source === positions.get(link.source)) &&
      (link.target === 0 || old.geometry.target === positions.get(link.target))
    ) {
      shapes.set(link.id, old);
      continue;
    }
    const geometry = networkGeometry(link, positions);
    shapes.set(link.id, {
      id: link.id,
      sourceId: link.source,
      targetId: link.target,
      geometry,
      d: pathToSvgD(geometry.path),
      ends: {
        source: link.source === 0 ? 'cross' : 'bar',
        target: link.target === 0 ? 'cross' : 'arrow',
      },
      style,
    });
  }
  return shapes;
}

export function networkLabels(
  network,
  positions,
  zoom,
  options,
  selected = []
) {
  const labels = [...network.points.values(), ...network.links.values()].map(
    (item) => {
      const at = positions.get(item.id) ?? { x: 0, y: 0 };
      const text = String(item.label ?? item.id);
      return {
        id: item.id,
        text,
        x: at.x + 8,
        y: at.y - 18,
        width: [...text].reduce(
          (width, char) => width + (char.codePointAt(0) > 255 ? 16 : 8),
          0
        ),
        height: 16,
        priority: selected.includes(item.id) ? 1 : 0,
      };
    }
  );
  const visible = new Set(visibleLabels(labels, zoom, options));
  return labels.filter((label) => visible.has(label.id));
}

export function highlightIds(network, hovered) {
  return hovered === null
    ? new Set()
    : new Set([hovered, ...networkNeighbours(network, hovered)]);
}

const attr = (value) => escapeAttribute(String(value));

export function networkItemSvg(
  shape,
  positions,
  colors,
  selected,
  highlighted
) {
  const { id, geometry, ends, style } = shape;
  const color = selected
    ? colors.focus
    : highlighted
      ? colors.blueprintStart
      : colors.line;
  const c = geometry.center;
  const line = (d, start, end) =>
    `<path d="${d}" fill="none" stroke="${attr(color)}" stroke-width="${selected || highlighted ? 2 : 1}" marker-start="url(#${markerElementId('network', 'source', start)})" marker-end="url(#${markerElementId('network', 'target', end)})"></path>`;
  const paths =
    style === 'node-edge'
      ? `${line(shape.d, ends.source, ends.target)}<circle cx="${c.x}" cy="${c.y}" r="5" fill="${attr(color)}"></circle>`
      : line(shape.d, ends.source, ends.target);
  return `<g data-id="${attr(id)}" data-selected="${selected}" data-highlighted="${highlighted}">${paths}</g>`;
}

/** Marker definitions come exclusively from #41, shared with Canvas. */
export function networkDefs(colors) {
  return ['bar', 'arrow', 'cross']
    .map((shape) =>
      svgMarkerDefs({ source: shape, target: shape }, colors, {
        idPrefix: 'network',
      })
    )
    .join('')
    .replaceAll('/>', '></path>');
}

export function networkPointSvg(
  id,
  point,
  colors,
  selected = false,
  highlighted = false
) {
  return `<circle data-point="${attr(id)}" cx="${point.x}" cy="${point.y}" r="4" fill="${attr(selected ? colors.focus : highlighted ? colors.blueprintStart : colors.line)}"></circle>`;
}

export function networkLabelSvg(label, colors) {
  return `<text x="${label.x}" y="${label.y + 13}" font-family="monospace" font-size="13" fill="${attr(colors.line)}">${attr(label.text)}</text>`;
}

/** Paint a cached scene without allocating geometry or starting a frame loop. */
export function drawNetworkCanvas(ctx, shapes, network, positions, options) {
  const {
    colors,
    view,
    width,
    height,
    selected = [],
    hovered,
    pixelRatio = 1,
  } = options;
  const highlighted = highlightIds(network, hovered);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  ctx.transform(view.k, 0, 0, view.k, view.x, view.y);
  for (const shape of shapes.values()) {
    const { id, geometry, ends } = shape;
    const color = selected.includes(id)
      ? colors.focus
      : highlighted.has(id)
        ? colors.blueprintStart
        : colors.line;
    ctx.lineWidth = selected.includes(id) || highlighted.has(id) ? 2 : 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(geometry.path[0].p0.x, geometry.path[0].p0.y);
    for (const s of geometry.path) {
      ctx.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p3.x, s.p3.y);
    }
    ctx.stroke();
    const angles = endAngles(geometry.path);
    for (const [end, at, angle] of [
      ['source', geometry.path[0].p0, angles.start],
      ['target', geometry.path.at(-1).p3, angles.end],
    ]) {
      drawMarker(ctx, getMarker(ends[end]), at, angle, ctx.lineWidth, {
        color: colors[end],
        Path2D: options.Path2D,
      });
    }
    if (shape.style === 'node-edge') {
      ctx.beginPath();
      ctx.arc(geometry.center.x, geometry.center.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  for (const id of network.points.keys()) {
    const point = positions.get(id);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = selected.includes(id)
      ? colors.focus
      : highlighted.has(id)
        ? colors.blueprintStart
        : colors.line;
    ctx.fill();
  }
  for (const label of networkLabels(
    network,
    positions,
    view.k,
    options.labels,
    selected
  )) {
    ctx.fillStyle = colors.line;
    ctx.font = '13px monospace';
    ctx.fillText(label.text, label.x, label.y + 13);
  }
}
