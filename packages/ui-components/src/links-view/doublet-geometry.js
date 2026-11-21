import { add, sub, scale, pathBounds, segmentLength } from './geometry.js';
import { doubletPairs, readDoubletOptions } from './doublet-options.js';
import { doubletPlaces } from './doublet-layout.js';
import { doubletCurves, trimCubic } from './doublet-curves.js';
import {
  markerExtent,
  placeDoubletMarkers,
  compensatedMarker,
  markerTipExtension,
} from './doublet-markers.js';
import { doubletCaption } from './doublet-svg.js';

function fit(curves, o, pairs) {
  const width = 100 * Math.max(1, o.width / o.height),
    height = 100 * Math.max(1, o.height / o.width);
  const caption = doubletCaption(pairs, o, '0') ? o.caption.size * 1.8 + 2 : 0;
  const margin = Math.min(
    48,
    Math.max(
      o.padding,
      ...['start', 'end', 'middle'].map(
        (key) => markerExtent(o[key], o) + o.strokeWidth / 2
      )
    )
  );
  const boxes = curves.map((c) => pathBounds(c.path));
  const box = boxes.reduce(
    (b, c) => ({
      minX: Math.min(b.minX, c.minX),
      minY: Math.min(b.minY, c.minY),
      maxX: Math.max(b.maxX, c.maxX),
      maxY: Math.max(b.maxY, c.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  if (!curves.length) {
    Object.assign(box, { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  }
  const inset = o.card.inset + (o.card.border === 'none' ? 0 : o.card.width);
  const availableWidth = Math.max(1, width - 2 * (margin + inset)),
    availableHeight = Math.max(1, height - 2 * (margin + inset) - caption);
  const k = Math.min(
    60,
    availableWidth / (box.maxX - box.minX || 1),
    availableHeight / (box.maxY - box.minY || 1)
  );
  const transform = o.frame ?? [
    k,
    width / 2 - ((box.minX + box.maxX) * k) / 2,
    (height - caption) / 2 - ((box.minY + box.maxY) * k) / 2,
  ];
  return {
    bounds: { x: 0, y: 0, width, height },
    transform,
    margin,
    captionRoom: caption,
  };
}
/**
 * A start/end gap at another link's middle moves that end and its handle back
 * along the end tangent, so the end keeps its direction near the middle.
 * Free and self-loop ends are trimmed by arc length.
 */
function backedEnds(path, gaps, references = [false, false]) {
  const moved = path.map((s, side) => {
    if (!references[side] || !gaps[side]) {
      return s;
    }
    const [end, handle] = side === 0 ? ['p0', 'c1'] : ['p3', 'c2'];
    const tangent = sub(s[handle], s[end]);
    const length = Math.hypot(tangent.x, tangent.y);
    if (length < 1e-12) {
      return s;
    }
    const shift = scale(tangent, gaps[side] / length);
    return { ...s, [end]: add(s[end], shift), [handle]: add(s[handle], shift) };
  });
  return {
    path: moved,
    gaps: gaps.map((g, i) => (i < 2 && moved[i] !== path[i] ? 0 : g)),
  };
}
export function fittedCurve(curve, transform, o) {
  const [k, x, y] = transform,
    point = (p) => add(scale(p, k), { x, y });
  const path = curve.path.map(({ p0, c1, c2, p3 }) => ({
    p0: point(p0),
    c1: point(c1),
    c2: point(c2),
    p3: point(p3),
  }));
  const gaps = (o.links[curve.id]?.gaps ?? [null, null, null, null]).map(
    (v, i) => (v ?? o.gaps[i]) * (i < 2 ? k : 1)
  );
  const cut = backedEnds(path, gaps, curve.references);
  const markers = placeDoubletMarkers({ path: cut.path }, cut.gaps, o);
  const cap = o.linecap === 'butt' ? 0 : o.strokeWidth / 2;
  const trim = ['start', 'end'].map((end) =>
    compensatedMarker(o[end], end, o) ? markerTipExtension(o[end], o) + cap : 0
  );
  const visible = [
    trimCubic(cut.path[0], cut.gaps[0] + trim[0], gaps[2]),
    trimCubic(cut.path[1], gaps[3], cut.gaps[1] + trim[1]),
  ];
  return {
    ...curve,
    middle: point(curve.middle),
    path,
    visible,
    gaps,
    markers,
    lengths: path.map((s) => segmentLength(s)),
    cutLengths: cut.path.map((s) => segmentLength(s)),
  };
}

/** Independently implemented doublet frame; options are canonical LiNo text. */
export function doubletGeometry(items, options = '', index = '0') {
  const pairs = doubletPairs(items),
    o = readDoubletOptions(options, pairs.length);
  const places = doubletPlaces(pairs, o),
    layoutCurves = doubletCurves(pairs, places, o);
  const fitted = fit(layoutCurves, o, pairs);
  const [k, x, y] = fitted.transform;
  return {
    ...fitted,
    positions: new Map(
      [...places].map(([id, p]) => [id, add(scale(p, k), { x, y })])
    ),
    pins: new Map(),
    places,
    layoutCurves,
    curves: layoutCurves.map((c) => fittedCurve(c, fitted.transform, o)),
    pairs,
    options: o,
    index,
  };
}
