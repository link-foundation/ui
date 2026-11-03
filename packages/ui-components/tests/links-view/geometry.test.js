/**
 * Behaviour: the geometry of one link is pure and exact. The centre of a
 * link is the point halfway along its arc length; the numbers below were
 * checked against a 200 000-piece polyline (experiments/issue-41).
 */

import { describe, it, expect } from 'test-anywhere';
import {
  catmullRomToCubics,
  controlPoints,
  cubicPoint,
  endAngles,
  linkGeometry,
  pathBounds,
  pathLength,
  pointAtLength,
  selfLoopPoints,
  POINT_COUNT,
} from '../../src/links-view/geometry.js';

const TOLERANCE = 1e-6;

const near = (actual, expected, tolerance = TOLERANCE) => {
  expect(Math.abs(actual - expected) <= tolerance).toBe(true);
};

const nearPoint = (actual, expected, tolerance = TOLERANCE) => {
  near(actual.x, expected.x, tolerance);
  near(actual.y, expected.y, tolerance);
};

describe('linkGeometry', () => {
  it('puts the centre of a straight link halfway between its ends', () => {
    const g = linkGeometry({
      source: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
    });
    nearPoint(g.center, { x: 50, y: 0 });
    near(g.length, 100);
    expect(g.selfLoop).toBe(false);
    expect(g.points.length).toBe(POINT_COUNT);
    expect(g.path.length).toBe(POINT_COUNT - 1);
  });

  it('finds the centre of a curved link at fixed numbers', () => {
    const g = linkGeometry({
      source: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      bend: 0.25,
    });
    nearPoint(g.center, { x: 50, y: -25 });
    near(g.length, 114.76297160692593);
    nearPoint(pointAtLength(g.path, 0.25), {
      x: 22.621635247062446,
      y: -17.504251434551065,
    });
  });

  it('finds the centre of a slanted curved link at fixed numbers', () => {
    const g = linkGeometry({
      source: { x: 10, y: 20 },
      target: { x: 130, y: 70 },
      bend: -0.3,
    });
    nearPoint(g.center, { x: 55, y: 81 });
    near(g.length, 156.54157749596536);
    nearPoint(pointAtLength(g.path, 0.25), {
      x: 26.01768144716889,
      y: 55.57964854559197,
    });
  });

  it('draws a self-loop above its anchor', () => {
    const g = linkGeometry({ source: { x: 0, y: 0 }, selfLoop: true });
    expect(g.selfLoop).toBe(true);
    nearPoint(g.center, { x: 0, y: -62.400000000000006 });
    near(g.length, 167.78331483177902);
    nearPoint(pointAtLength(g.path, 0.25), {
      x: -23.831570477321204,
      y: -34.096806740717945,
    });
    // The loop starts and ends at the anchor.
    nearPoint(g.path[0].p0, { x: 0, y: 0 });
    nearPoint(g.path.at(-1).p3, { x: 0, y: 0 });
  });

  it('makes a self-loop of a link whose ends are the same point', () => {
    const p = { x: 5, y: 5 };
    expect(linkGeometry({ source: p, target: { ...p } }).selfLoop).toBe(true);
    expect(linkGeometry({ source: p }).selfLoop).toBe(true);
  });

  it('rejects a source that is not a point', () => {
    expect(() => linkGeometry({ source: { x: 'a', y: 0 } })).toThrow(TypeError);
    expect(() => linkGeometry({})).toThrow(TypeError);
  });
});

describe('pointAtLength', () => {
  const g = linkGeometry({ source: { x: 0, y: 0 }, target: { x: 100, y: 0 } });

  it('returns the ends at 0 and 1 and clamps outside', () => {
    nearPoint(pointAtLength(g.path, 0), { x: 0, y: 0 });
    nearPoint(pointAtLength(g.path, 1), { x: 100, y: 0 });
    nearPoint(pointAtLength(g.path, -1), { x: 0, y: 0 });
    nearPoint(pointAtLength(g.path, 2), { x: 100, y: 0 });
  });

  it('moves at constant speed along a straight link', () => {
    for (const t of [0.1, 0.33, 0.5, 0.9]) {
      nearPoint(pointAtLength(g.path, t), { x: 100 * t, y: 0 });
    }
  });
});

describe('curve helpers', () => {
  it('passes a Catmull-Rom spline through its points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ];
    const path = catmullRomToCubics(points);
    expect(path.length).toBe(2);
    nearPoint(cubicPoint(path[0], 0), points[0]);
    nearPoint(cubicPoint(path[0], 1), points[1]);
    nearPoint(cubicPoint(path[1], 1), points[2]);
  });

  it('spaces the control points evenly with a bend offset', () => {
    const points = controlPoints({ x: 0, y: 0 }, { x: 80, y: 0 }, 0.5);
    expect(points.length).toBe(POINT_COUNT);
    nearPoint(points[0], { x: 0, y: 0 });
    nearPoint(points.at(-1), { x: 80, y: 0 });
    nearPoint(points[4], { x: 40, y: -40 });
  });

  it('closes a self-loop at the anchor', () => {
    const points = selfLoopPoints({ x: 0, y: 0 }, 10);
    nearPoint(points[0], { x: 0, y: 0 });
    nearPoint(points.at(-1), { x: 0, y: 0 });
  });

  it('measures lengths, bounds and end angles', () => {
    const g = linkGeometry({ source: { x: 0, y: 0 }, target: { x: 0, y: 50 } });
    near(pathLength(g.path), 50);
    const b = pathBounds(g.path);
    near(b.minY, 0);
    near(b.maxY, 50);
    const angles = endAngles(g.path);
    // Both ends point the way the line goes (+y), as SVG orient="auto" does.
    near(angles.start, Math.PI / 2);
    near(Math.cos(angles.end), 0);
    near(Math.sin(angles.end), 1);
  });
});
