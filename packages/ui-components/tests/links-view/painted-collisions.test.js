import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  doubletGeometry,
  scorePaintedCollisions as score,
} from '@link-foundation/ui-components/links-view';

const point = (x, y) => ({ x, y });
const line = (x, y, xx, yy) => {
  const a = point(x, y);
  const b = point(xx, yy);
  return { p0: a, c1: a, c2: b, p3: b };
};
const curve = (first, second = null, middle = point(50, 50), markers = []) => ({
  visible: [first, second],
  middle,
  markers,
});

function scene(curves, options = '') {
  return {
    ...doubletGeometry([], options),
    curves,
  };
}

test('a crossing costs more than an overlap, which costs more than a clearance miss', () => {
  const horizontal = curve(line(0, 0, 10, 0));
  const measure = (other) => score(scene([horizontal, curve(other)]));
  const crossing = measure(line(5, -4, 5, 4));
  const overlap = measure(line(0, 0.5, 10, 0.5));
  const near = measure(line(0, 1.5, 10, 1.5));
  assert.deepEqual([crossing.count, overlap.count, near.count], [1, 1, 1]);
  assert.ok(crossing.cost > overlap.cost);
  assert.ok(overlap.cost > near.cost);
  assert.deepEqual(measure(line(0, 2.1, 10, 2.1)), { count: 0, cost: 0 });
});

test('scores a filled marker interior, a hollow marker rim and an acute miter tip', () => {
  const marker = (shape, size, angle = 45) =>
    curve(null, null, point(50, 50), [
      { marker: { shape, size, angle }, point: point(0, 0), angle: 0 },
    ]);
  const inside = curve(line(-0.5, 0, 0.5, 0));
  assert.equal(score(scene([marker('dot', 10), inside])).count, 1);
  assert.equal(score(scene([marker('square', 10), inside])).count, 1);
  assert.equal(score(scene([marker('diamond', 10), inside])).count, 1);
  assert.equal(score(scene([marker('circle', 10), inside])).count, 0);
  const dot = marker('dot', 10);
  const outside = curve(line(5.3, -0.1, 5.3, 0.1));
  assert.equal(
    score(scene([dot, outside], 'clearance 0\nstrokeWidth 0.5')).count,
    0
  );
  dot.markers[0].strokeWidth = 1;
  assert.equal(
    score(scene([dot, outside], 'clearance 0\nstrokeWidth 0.5')).count,
    1
  );
  assert.equal(
    score(scene([marker('circle', 10), curve(line(5, 0, 5, 0.5))])).count,
    1
  );
  const tip = [marker('arrow', 10, 10), curve(line(2.6, -0.15, 2.6, 0.15))];
  assert.equal(score(scene(tip, 'clearance 0')).count, 1);
  assert.equal(score(scene(tip, 'clearance 0\narrowJoin bevel')).count, 0);
});

test('clips the own-half joint and respects real breaks and dash gaps', () => {
  const first = line(-10, 0, 15, 0);
  const second = line(0, -5, 0, 5);
  assert.equal(score(scene([curve(first, second, point(0, 0))])).count, 0);
  assert.equal(score(scene([curve(first, second)])).count, 1);
  const cut = curve(line(-10, 0, -3, 0), line(3, 0, 15, 0));
  assert.equal(score(scene([cut, curve(second)])).count, 0);
  const dashes = scene(
    [curve(line(0, 0, 10, 0)), curve(line(5, -0.2, 5, 0.2))],
    'dash dashed\nlinecap butt\nclearance 0'
  );
  assert.equal(score(dashes).count, 0);
});

test('scores an endpoint marker against other paint on the same link', () => {
  const left = line(-12, 0, 0, 0);
  const right = line(0, 0, 12, 0);
  const marker = (end, x) => ({
    end,
    marker: { shape: 'dot', size: 2, angle: 45 },
    point: point(x, 0),
    angle: 0,
  });
  const measure = (markers) =>
    score(scene([curve(left, right, point(0, 0), markers)])).count;
  assert.equal(measure([marker('start', -8)]), 0);
  assert.equal(measure([marker('start', 8)]), 1);
  assert.equal(measure([marker('start', 8), marker('end', 8)]), 2);
});
