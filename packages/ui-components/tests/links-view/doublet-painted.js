/**
 * Test-only painted geometry probe for doublet frames (issue 249). It is
 * independent of any collision solver: it samples what the renderer paints,
 * the visible cubics with half the stroke width and the placed marker outlines
 * with their stroke, filled dots and the compensated painted arrow tips.
 */
import { cubicPoint } from '../../src/links-view/geometry.js';
import { rotate, radians } from '../../src/links-view/doublet-layout.js';

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;

/** Polylines of each visible half, `steps` segments per cubic. */
export function visiblePolylines(curve, steps = 256) {
  return curve.visible.map((segment) =>
    segment
      ? Array.from({ length: steps + 1 }, (_, i) =>
          cubicPoint(segment, i / steps)
        )
      : []
  );
}

/** Proper intersections of two polylines (shared endpoints do not count). */
export function polylineCrossings(first, second) {
  const found = [];
  for (let i = 1; i < first.length; i++) {
    for (let j = 1; j < second.length; j++) {
      const p = first[i - 1],
        q = second[j - 1],
        u = sub(first[i], p),
        v = sub(second[j], q),
        w = sub(q, p),
        denominator = cross(u, v);
      if (Math.abs(denominator) < 1e-12) {
        continue;
      }
      const t = cross(w, v) / denominator,
        s = cross(w, u) / denominator;
      if (t > 0 && t < 1 && s > 0 && s < 1) {
        found.push({ x: p.x + t * u.x, y: p.y + t * u.y });
      }
    }
  }
  return found;
}

function outline(shape, size, angle) {
  const r = size / 2,
    x = size * Math.cos(radians(angle)),
    y = size * Math.sin(radians(angle));
  const circle = Array.from({ length: 33 }, (_, i) => ({
    x: r * Math.cos((i * Math.PI) / 16),
    y: r * Math.sin((i * Math.PI) / 16),
  }));
  const back = shape === 'tail' ? x : -x;
  return {
    bar: [
      { x: 0, y: -r },
      { x: 0, y: r },
    ],
    arrow: [
      { x: back, y: -y },
      { x: 0, y: 0 },
      { x: back, y },
    ],
    tail: [
      { x: back, y: -y },
      { x: 0, y: 0 },
      { x: back, y },
    ],
    triangle: [
      { x: back, y: -y },
      { x: 0, y: 0 },
      { x: back, y },
      { x: back, y: -y },
    ],
    square: [
      { x: -r, y: -r },
      { x: r, y: -r },
      { x: r, y: r },
      { x: -r, y: r },
      { x: -r, y: -r },
    ],
    diamond: [
      { x: -r, y: 0 },
      { x: 0, y: -r },
      { x: r, y: 0 },
      { x: 0, y: r },
      { x: -r, y: 0 },
    ],
    circle,
    dot: circle,
    none: [],
  }[shape];
}

/** Painted discs `{x, y, r}` that cover what one link paints. */
export function paintedDiscs(curve, o, steps = 256) {
  const half = o.strokeWidth / 2,
    discs = [];
  for (const line of visiblePolylines(curve, steps)) {
    line.forEach((p) => discs.push({ ...p, r: half }));
  }
  for (const placed of curve.markers) {
    const { shape, size, angle } = placed.marker;
    if (shape === 'dot') {
      discs.push({ ...placed.point, r: size / 2 });
      continue;
    }
    const points = outline(shape, size, angle).map((p) => {
      const turned = rotate(p, placed.angle);
      return { x: turned.x + placed.point.x, y: turned.y + placed.point.y };
    });
    for (let i = 1; i < points.length; i++) {
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        discs.push({
          x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
          y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
          r: half,
        });
      }
    }
    if (placed.compensated) {
      // The painted miter tip of a compensated marker lands on its anchor.
      discs.push({ ...placed.anchor, r: 0 });
    }
  }
  return discs;
}

function smallestGap(a, b) {
  let gap = Infinity;
  for (const p of a) {
    for (const q of b) {
      gap = Math.min(gap, Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r);
    }
  }
  return gap;
}

/**
 * Crossings between links (counted everywhere), crossings between a link's own
 * halves outside the joint radius `strokeWidth + clearance + middle size / 2`,
 * and the smallest painted gap (box units) between any two different links.
 * Like the painted scoring of issue 228, nothing is exempt near a middle.
 */
export function paintedReport(frame, { clearance = 1, steps = 256 } = {}) {
  const o = frame.options,
    lines = frame.curves.map((curve) => visiblePolylines(curve, steps));
  const crossings = [],
    ownCrossings = [];
  let gap = Infinity;
  frame.curves.forEach((curve, i) => {
    const joint = o.strokeWidth + clearance + o.middle.size / 2;
    for (const p of polylineCrossings(lines[i][0], lines[i][1])) {
      if (Math.hypot(p.x - curve.middle.x, p.y - curve.middle.y) > joint) {
        ownCrossings.push({ link: curve.id, ...p });
      }
    }
    for (let j = i + 1; j < frame.curves.length; j++) {
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          for (const p of polylineCrossings(lines[i][a], lines[j][b])) {
            crossings.push({
              links: [curve.id, frame.curves[j].id],
              halves: [a, b],
              ...p,
            });
          }
        }
      }
      gap = Math.min(
        gap,
        smallestGap(
          paintedDiscs(curve, o, steps),
          paintedDiscs(frame.curves[j], o, steps)
        )
      );
    }
  });
  return { crossings, ownCrossings, gap };
}
