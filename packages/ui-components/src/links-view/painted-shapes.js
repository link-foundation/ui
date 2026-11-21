import { add, sub, scale, lerp } from './geometry.js';
import { rotate } from './doublet-layout.js';
import { splitCubic } from './doublet-curves.js';
import { doubletMarkerVertices, markerMiterLimit } from './doublet-markers.js';

const EPSILON = 1e-9;
const FLATNESS = 0.05;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const lengthSquared = (v) => dot(v, v);

export function pointSegmentSquared(point, { a, b }) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const x = point.x - a.x,
    y = point.y - a.y;
  const projection = x * dx + y * dy;
  if (projection <= 0) {
    return x * x + y * y;
  }
  const span = dx * dx + dy * dy;
  if (projection >= span) {
    return (x - dx) ** 2 + (y - dy) ** 2;
  }
  const area = dx * y - dy * x;
  return (area * area) / span;
}

function flatten(s, points, depth = 0) {
  const chord = { a: s.p0, b: s.p3 };
  const error = Math.max(
    pointSegmentSquared(s.c1, chord),
    pointSegmentSquared(s.c2, chord)
  );
  if (error <= FLATNESS * FLATNESS || depth === 12) {
    points.push(s.p3);
  } else {
    for (const part of splitCubic(s, 0.5)) {
      flatten(part, points, depth + 1);
    }
  }
}

export function visiblePoints(cubic) {
  if (!cubic) {
    return [];
  }
  const points = [cubic.p0];
  flatten(cubic, points);
  return points;
}

function box(points, r = 0) {
  return {
    minX: Math.min(...points.map((p) => p.x)) - r,
    minY: Math.min(...points.map((p) => p.y)) - r,
    maxX: Math.max(...points.map((p) => p.x)) + r,
    maxY: Math.max(...points.map((p) => p.y)) + r,
  };
}

export function boxesNear(a, b, clearance) {
  return (
    a.minX <= b.maxX + clearance &&
    b.minX <= a.maxX + clearance &&
    a.minY <= b.maxY + clearance &&
    b.minY <= a.maxY + clearance
  );
}

function segment(a, b, radius = 0) {
  return {
    a,
    b,
    radius,
    bounds: {
      minX: Math.min(a.x, b.x) - radius,
      minY: Math.min(a.y, b.y) - radius,
      maxX: Math.max(a.x, b.x) + radius,
      maxY: Math.max(a.y, b.y) + radius,
    },
  };
}

function polygon(vertices) {
  return {
    vertices,
    bounds: box(vertices),
    edges: vertices.map((p, i) =>
      segment(p, vertices[(i + 1) % vertices.length])
    ),
  };
}

export function component(parts) {
  if (!parts.length) {
    return null;
  }
  const bounds = { ...parts[0].bounds };
  for (const { bounds: b } of parts) {
    bounds.minX = Math.min(bounds.minX, b.minX);
    bounds.minY = Math.min(bounds.minY, b.minY);
    bounds.maxX = Math.max(bounds.maxX, b.maxX);
    bounds.maxY = Math.max(bounds.maxY, b.maxY);
  }
  return { bounds, parts };
}

function outsideJoint(a, b, joint) {
  if (!joint) {
    return [[a, b]];
  }
  const v = sub(b, a),
    w = sub(a, joint.center);
  const aa = dot(v, v),
    bb = dot(w, v);
  const cc = dot(w, w) - joint.radius ** 2;
  const discriminant = bb ** 2 - aa * cc;
  if (discriminant <= 0 || aa < EPSILON) {
    return cc >= 0 ||
      dot(sub(b, joint.center), sub(b, joint.center)) >= joint.radius ** 2
      ? [[a, b]]
      : [];
  }
  const t = (-bb - Math.sqrt(discriminant)) / aa;
  const u = (-bb + Math.sqrt(discriminant)) / aa;
  if (t >= 1 || u <= 0) {
    return [[a, b]];
  }
  const outside = [];
  if (t > 0) {
    outside.push([a, lerp(a, b, t)]);
  }
  if (u < 1) {
    outside.push([lerp(a, b, u), b]);
  }
  return outside;
}

function strokeStrip(
  a,
  b,
  radius,
  extendStart = 0,
  extendEnd = 0,
  v = sub(b, a)
) {
  const n = Math.hypot(v.x, v.y);
  if (n < EPSILON) {
    return null;
  }
  const normal = { x: (-v.y * radius) / n, y: (v.x * radius) / n };
  const start = sub(a, scale(v, extendStart / n));
  const end = add(b, scale(v, extendEnd / n));
  return polygon([
    add(start, normal),
    add(end, normal),
    sub(end, normal),
    sub(start, normal),
  ]);
}

export function strokeDashDot(point, from, to, radius, cap, joint) {
  if (cap === 'butt' || !outsideJoint(point, point, joint).length) {
    return null;
  }
  return cap === 'round'
    ? segment(point, point, radius)
    : strokeStrip(point, point, radius, radius, radius, sub(to, from));
}

/** Stroke strips and round joins approximate the visible cubic within FLATNESS. */
export function strokeParts(points, radius, cap, joint) {
  const parts = [];
  const square = cap === 'square' ? radius : 0;
  for (let i = 1; i < points.length; i++) {
    for (const [a, b] of outsideJoint(points[i - 1], points[i], joint)) {
      if (cap === 'round' && !joint) {
        const part = segment(a, b, radius);
        part.centerline = part;
        parts.push(part);
        continue;
      }
      const first = i === 1 && a === points[0];
      const last = i === points.length - 1;
      const strip = strokeStrip(
        a,
        b,
        radius,
        first ? square : 0,
        b === points.at(-1) ? square : 0
      );
      if (strip) {
        strip.centerline = segment(a, b);
        parts.push(strip);
      }
      if (b === points[i] && (!last || cap === 'round')) {
        parts.push(segment(b, b, radius));
      }
      if (first && cap === 'round') {
        parts.push(segment(a, a, radius));
      }
    }
  }
  return parts;
}

function strokeJoin(previous, p, next, radius, join, limit) {
  if (join === 'round') {
    return segment(p, p, radius);
  }
  const a = sub(p, previous),
    b = sub(next, p);
  const turn = cross(a, b);
  if (Math.abs(turn) < EPSILON) {
    return null;
  }
  const offset = (v) =>
    scale(
      { x: v.y, y: -v.x },
      (Math.sign(turn) * radius) / Math.hypot(v.x, v.y)
    );
  const first = add(p, offset(a));
  const last = add(p, offset(b));
  const tip = add(first, scale(a, cross(sub(last, first), b) / turn));
  return join === 'miter' && lengthSquared(sub(tip, p)) <= (limit * radius) ** 2
    ? polygon([p, first, tip, last])
    : polygon([p, first, last]);
}

const radiansForCircle = (i) => (i * Math.PI) / 16;
const closedShapes = Object.freeze(['circle', 'square', 'diamond', 'triangle']);
function markerStroke(points, radius, { closed, cap, join, limit }) {
  const parts = [];
  const open = Number(!closed);
  const spans = points.length - open;
  const extension = !closed && cap === 'square' ? radius : 0;
  for (let i = 0; i < spans; i++) {
    const strip = strokeStrip(
      points[i],
      points[(i + 1) % points.length],
      radius,
      i === 0 ? extension : 0,
      i === spans - 1 ? extension : 0
    );
    if (strip) {
      parts.push(strip);
    }
  }
  if (!closed && cap === 'round') {
    for (const p of [points[0], points.at(-1)]) {
      parts.push(segment(p, p, radius));
    }
  }
  for (let i = open; i < spans; i++) {
    const corner = strokeJoin(
      points.at(i - 1),
      points[i],
      points[(i + 1) % points.length],
      radius,
      join,
      limit
    );
    if (corner) {
      parts.push(corner);
    }
  }
  return parts;
}

export function paintedMarker(placement, options) {
  const { marker, point, angle } = placement;
  const { shape, size } = marker;
  if (shape === 'none') {
    return null;
  }
  const strokeWidth =
    placement.strokeWidth ?? (shape === 'dot' ? 0 : options.strokeWidth);
  if (shape === 'dot') {
    return component([segment(point, point, (size + strokeWidth) / 2)]);
  }
  const closed = closedShapes.includes(shape);
  const local =
    shape === 'circle'
      ? Array.from({ length: 32 }, (_, i) => {
          const phase = radiansForCircle(i);
          return [(size / 2) * Math.cos(phase), (size / 2) * Math.sin(phase)];
        })
      : doubletMarkerVertices(marker);
  const points =
    placement.vertices ??
    local.map(([x, y]) => add(point, rotate({ x, y }, angle)));
  const parts = markerStroke(points, strokeWidth / 2, {
    closed,
    cap: placement.linecap ?? 'butt',
    join: placement.linejoin ?? options.arrowJoin,
    limit: placement.miterLimit ?? markerMiterLimit(marker),
  });
  if (closed && shape !== 'circle') {
    parts.push(polygon(points));
  }
  return component(parts);
}

function intersection(first, second) {
  const ax = first.b.x - first.a.x,
    ay = first.b.y - first.a.y;
  const bx = second.b.x - second.a.x,
    by = second.b.y - second.a.y;
  const denominator = ax * by - ay * bx;
  if (Math.abs(denominator) < EPSILON) {
    return null;
  }
  const dx = second.a.x - first.a.x,
    dy = second.a.y - first.a.y;
  const t = (dx * by - dy * bx) / denominator;
  if (t < 0 || t > 1) {
    return null;
  }
  const u = (dx * ay - dy * ax) / denominator;
  return u >= 0 && u <= 1 ? t : null;
}

function segmentDistanceSquared(a, b) {
  return intersection(a, b) !== null
    ? 0
    : Math.min(
        pointSegmentSquared(a.a, b),
        pointSegmentSquared(a.b, b),
        pointSegmentSquared(b.a, a),
        pointSegmentSquared(b.b, a)
      );
}

function inside(p, poly) {
  let sign = 0;
  for (const { a, b } of poly.edges) {
    const side = cross(sub(b, a), sub(p, a));
    if (Math.abs(side) > EPSILON) {
      if (sign && Math.sign(side) !== sign) {
        return false;
      }
      sign = Math.sign(side);
    }
  }
  return true;
}

function distanceToPolygon(line, poly) {
  if (inside(line.a, poly) || inside(line.b, poly)) {
    return 0;
  }
  let distance = Infinity;
  for (const edge of poly.edges) {
    distance = Math.min(distance, segmentDistanceSquared(line, edge));
  }
  return Math.sqrt(distance);
}

export function paintedDistance(a, b) {
  if (a.vertices) {
    if (!b.vertices) {
      return distanceToPolygon(b, a) - b.radius;
    }
    if (inside(a.vertices[0], b) || inside(b.vertices[0], a)) {
      return 0;
    }
    let distance = Infinity;
    for (const edge of b.edges) {
      distance = Math.min(distance, distanceToPolygon(edge, a));
    }
    return distance;
  }
  return b.vertices
    ? distanceToPolygon(a, b) - a.radius
    : Math.sqrt(segmentDistanceSquared(a, b)) - a.radius - b.radius;
}

export function strokeCrossing(a, b) {
  if (!a.centerline || !b.centerline) {
    return null;
  }
  const t = intersection(a.centerline, b.centerline);
  return t === null ? null : lerp(a.centerline.a, a.centerline.b, t);
}
