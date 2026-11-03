/**
 * The geometry of one link: pure functions from end points to a path of
 * cubic Bézier segments, its arc length and its centre (the point half way
 * along the path). Ported from links-visuals (Unlicense): nine control
 * points from the source to the target, joined by a Catmull-Rom spline whose
 * segments are written as cubic Béziers.
 *
 * Nothing here reads the DOM, the clock or random numbers, so the same input
 * always gives the same numbers.
 */

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{p0: Point, c1: Point, c2: Point, p3: Point}} CubicSegment
 * @typedef {object} LinkGeometry
 * @property {CubicSegment[]} path  the link from the source to the target
 * @property {Point} center  the point at half the arc length (the anchor)
 * @property {number} length  the arc length of the path
 * @property {Point[]} points  the control points the spline passes through
 *   (the blueprint points: start, three, centre, three, end)
 * @property {Point} source
 * @property {Point} target
 * @property {boolean} selfLoop
 */

/** The number of blueprint points (links-visuals: x factors -4..4). */
export const POINT_COUNT = 9;

/** The radius of a self-loop when none is given. */
export const DEFAULT_LOOP_RADIUS = 24;

/** The nodes and weights of 8-point Gauss-Legendre quadrature on [-1, 1]. */
const GAUSS = Object.freeze([
  Object.freeze([-0.9602898564975363, 0.1012285362903763]),
  Object.freeze([-0.7966664774136267, 0.2223810344533745]),
  Object.freeze([-0.525532409916329, 0.3137066458778873]),
  Object.freeze([-0.1834346424956498, 0.362683783378362]),
  Object.freeze([0.1834346424956498, 0.362683783378362]),
  Object.freeze([0.525532409916329, 0.3137066458778873]),
  Object.freeze([0.7966664774136267, 0.2223810344533745]),
  Object.freeze([0.9602898564975363, 0.1012285362903763]),
]);

/** Pieces each segment is cut into before the quadrature. */
const PIECES = 8;

/** Newton steps when a length is turned back into a curve parameter. */
const NEWTON_STEPS = 24;

export const point = (x, y) => ({ x, y });
export const add = (a, b) => point(a.x + b.x, a.y + b.y);
export const sub = (a, b) => point(a.x - b.x, a.y - b.y);
export const scale = (a, k) => point(a.x * k, a.y * k);
export const lerp = (a, b, t) =>
  point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const samePoint = (a, b) => a.x === b.x && a.y === b.y;

/** Whether a value is a point with finite coordinates. */
export const isPoint = (p) =>
  p !== null &&
  typeof p === 'object' &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y);

/**
 * The point of a cubic segment at the curve parameter `t` (0..1).
 * @param {CubicSegment} s
 * @param {number} t
 * @returns {Point}
 */
export function cubicPoint(s, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return point(
    a * s.p0.x + b * s.c1.x + c * s.c2.x + d * s.p3.x,
    a * s.p0.y + b * s.c1.y + c * s.c2.y + d * s.p3.y
  );
}

/**
 * The derivative (the tangent vector) of a cubic segment at `t`.
 * @param {CubicSegment} s
 * @param {number} t
 * @returns {Point}
 */
export function cubicDerivative(s, t) {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  return point(
    a * (s.c1.x - s.p0.x) + b * (s.c2.x - s.c1.x) + c * (s.p3.x - s.c2.x),
    a * (s.c1.y - s.p0.y) + b * (s.c2.y - s.c1.y) + c * (s.p3.y - s.c2.y)
  );
}

const speed = (s, t) => {
  const d = cubicDerivative(s, t);
  return Math.hypot(d.x, d.y);
};

/** The arc length of a segment between two curve parameters. */
function lengthBetween(s, t0, t1) {
  const half = (t1 - t0) / 2;
  const mid = (t0 + t1) / 2;
  return (
    GAUSS.reduce((sum, [x, w]) => sum + w * speed(s, mid + half * x), 0) * half
  );
}

/**
 * The arc length of a cubic segment from 0 to `t` (default 1), by
 * Gauss-Legendre quadrature on fixed pieces: deterministic, and accurate to
 * far below 1e-9 for the curves a link draws.
 * @param {CubicSegment} s
 * @param {number} [t]
 */
export function segmentLength(s, t = 1) {
  let sum = 0;
  for (let i = 0; i < PIECES; i += 1) {
    sum += lengthBetween(s, (t * i) / PIECES, (t * (i + 1)) / PIECES);
  }
  return sum;
}

/**
 * The arc length of a path.
 * @param {CubicSegment[]} path
 */
export const pathLength = (path) =>
  path.reduce((sum, s) => sum + segmentLength(s), 0);

/** The curve parameter at which a segment reaches the arc length `target`. */
function parameterAtLength(s, target, total) {
  if (target <= 0 || total === 0) {
    return 0;
  }
  if (target >= total) {
    return 1;
  }
  let lo = 0;
  let hi = 1;
  let t = target / total;
  for (let i = 0; i < NEWTON_STEPS; i += 1) {
    const error = segmentLength(s, t) - target;
    if (Math.abs(error) < 1e-12) {
      break;
    }
    if (error > 0) {
      hi = t;
    } else {
      lo = t;
    }
    const v = speed(s, t);
    const next = v > 0 ? t - error / v : (lo + hi) / 2;
    // Newton's step, kept inside the bracket (bisection when it leaves it).
    t = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  return t;
}

/** The segment and curve parameter at the arc-length fraction `fraction`. */
function locate(path, fraction) {
  const lengths = path.map((s) => segmentLength(s));
  const total = lengths.reduce((a, b) => a + b, 0);
  const clamped = Math.min(1, Math.max(0, fraction));
  let rest = clamped * total;
  for (let i = 0; i < path.length; i += 1) {
    if (rest <= lengths[i] || i === path.length - 1) {
      return {
        segment: path[i],
        t: parameterAtLength(path[i], rest, lengths[i]),
      };
    }
    rest -= lengths[i];
  }
  return null;
}

/**
 * The point at the arc-length fraction `t` (0 = start, 1 = end) of a path.
 * @param {CubicSegment[]} path
 * @param {number} t
 * @returns {Point}
 */
export function pointAtLength(path, t) {
  const at = locate(path, t);
  return at === null ? point(0, 0) : cubicPoint(at.segment, at.t);
}

/**
 * The direction (radians, 0 = +x, clockwise with y down) of a path at the
 * arc-length fraction `t`.
 * @param {CubicSegment[]} path
 * @param {number} t
 */
export function angleAtLength(path, t) {
  const at = locate(path, t);
  if (at === null) {
    return 0;
  }
  const d = cubicDerivative(at.segment, at.t);
  return Math.atan2(d.y, d.x);
}

/** The direction of the first non-degenerate handle of a segment. */
function handleAngle(from, handles) {
  const to = handles.find((p) => !samePoint(p, from)) ?? from;
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * The directions of a path at its two ends, as an SVG `orient="auto"`
 * marker takes them: along the path at the start and at the end.
 * @param {CubicSegment[]} path
 * @returns {{start: number, end: number}}
 */
export function endAngles(path) {
  if (path.length === 0) {
    return { start: 0, end: 0 };
  }
  const first = path[0];
  const last = path[path.length - 1];
  const end = handleAngle(last.p3, [last.c2, last.c1, last.p0]);
  return {
    start: handleAngle(first.p0, [first.c1, first.c2, first.p3]),
    end: end + Math.PI,
  };
}

/**
 * Catmull-Rom tangents as links-visuals takes them: one-sided at the ends,
 * central differences in between.
 * @param {Point[]} points
 * @returns {Point[]}
 */
export function catmullRomTangents(points) {
  const last = points.length - 1;
  return points.map((p, i) => {
    if (i === 0) {
      return sub(points[1], p);
    }
    if (i === last) {
      return sub(p, points[last - 1]);
    }
    return scale(sub(points[i + 1], points[i - 1]), 0.5);
  });
}

/**
 * A Catmull-Rom spline through `points`, written as cubic Bézier segments
 * (`c1 = p_i + m_i / 3`, `c2 = p_{i+1} - m_{i+1} / 3`).
 * @param {Point[]} points  at least two
 * @returns {CubicSegment[]}
 */
export function catmullRomToCubics(points) {
  if (points.length < 2) {
    return [];
  }
  const m = catmullRomTangents(points);
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({
      p0: points[i],
      c1: add(points[i], scale(m[i], 1 / 3)),
      c2: sub(points[i + 1], scale(m[i + 1], 1 / 3)),
      p3: points[i + 1],
    });
  }
  return segments;
}

/**
 * The nine control points of a link from `source` to `target`. With
 * `bend = 0` they lie evenly on the straight line; otherwise they are moved
 * along the left normal (y down) by `4 · bend · distance · f · (1 - f)`, a
 * parabola whose top is `bend · distance` away from the middle of the line.
 * @param {Point} source
 * @param {Point} target
 * @param {number} [bend]
 * @returns {Point[]}
 */
export function controlPoints(source, target, bend = 0) {
  const d = distance(source, target);
  const normal =
    d === 0
      ? point(0, 0)
      : point((target.y - source.y) / d, (source.x - target.x) / d);
  const points = [];
  for (let i = 0; i < POINT_COUNT; i += 1) {
    const f = i / (POINT_COUNT - 1);
    const offset = 4 * bend * d * f * (1 - f);
    points.push(add(lerp(source, target, f), scale(normal, offset)));
  }
  return points;
}

/**
 * The control points of a self-loop at `anchor`: a teardrop above it that
 * leaves to the upper left and comes back from the upper right, with its
 * top (the centre of the link) at `anchor.y - 2.6 · radius`.
 * @param {Point} anchor
 * @param {number} [radius]
 * @returns {Point[]}
 */
export function selfLoopPoints(anchor, radius = DEFAULT_LOOP_RADIUS) {
  const center = point(anchor.x, anchor.y - 1.6 * radius);
  const points = [anchor];
  const inner = POINT_COUNT - 2;
  for (let i = 0; i < inner; i += 1) {
    // From the lower left (150°) over the top (270°) to the lower right.
    const angle = (5 * Math.PI) / 6 + (i * (4 * Math.PI)) / 3 / (inner - 1);
    points.push(
      point(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle)
      )
    );
  }
  points.push(anchor);
  return points;
}

/**
 * The geometry of one link.
 * @param {{source: Point, target?: Point, bend?: number,
 *   selfLoop?: boolean, loopRadius?: number}} options  a link without a
 *   target, or with `selfLoop: true`, or whose ends are the same point, is
 *   drawn as a self-loop at the source
 * @returns {LinkGeometry}
 */
export function linkGeometry({
  source,
  target,
  bend = 0,
  selfLoop,
  loopRadius,
}) {
  if (!isPoint(source)) {
    throw new TypeError('linkGeometry: source must be a point {x, y}');
  }
  if (target !== undefined && !isPoint(target)) {
    throw new TypeError('linkGeometry: target must be a point {x, y}');
  }
  if (!Number.isFinite(bend)) {
    throw new TypeError('linkGeometry: bend must be a finite number');
  }
  const loop =
    selfLoop === true || target === undefined || samePoint(source, target);
  const points = loop
    ? selfLoopPoints(source, loopRadius)
    : controlPoints(source, target, bend);
  const path = catmullRomToCubics(points);
  return {
    path,
    center: pointAtLength(path, 0.5),
    length: pathLength(path),
    points,
    source,
    target: loop ? source : target,
    selfLoop: loop,
  };
}

/**
 * The bounding box of the points and control points of a path (a cubic
 * stays inside the hull of its four points).
 * @param {CubicSegment[]} path
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
export function pathBounds(path) {
  const all = path.flatMap((s) => [s.p0, s.c1, s.c2, s.p3]);
  return {
    minX: Math.min(...all.map((p) => p.x)),
    minY: Math.min(...all.map((p) => p.y)),
    maxX: Math.max(...all.map((p) => p.x)),
    maxY: Math.max(...all.map((p) => p.y)),
  };
}

/**
 * A number as short, stable text: rounded to `digits` decimals, without
 * trailing zeros and without `-0`.
 * @param {number} value
 * @param {number} [digits]
 */
export function fmt(value, digits = 3) {
  const rounded = Number(value.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * The SVG path data of a path (`M x y C ...`), with rounded numbers so that
 * the output is the same on every engine.
 * @param {CubicSegment[]} path
 * @returns {string}
 */
export function pathToSvgD(path) {
  if (path.length === 0) {
    return '';
  }
  const p = (q) => `${fmt(q.x)} ${fmt(q.y)}`;
  const curves = path.map((s) => `C ${p(s.c1)} ${p(s.c2)} ${p(s.p3)}`);
  return [`M ${p(path[0].p0)}`, ...curves].join(' ');
}
