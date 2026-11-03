import assert from 'node:assert/strict';
import { test } from 'node:test';
import { radialLayout, sectorAt } from '../../src/overlays/radial-geometry.js';

for (const count of [1, 3, 11]) {
  test(`radial positions and sector centers for ${count} items`, () => {
    const points = radialLayout(count, { radius: 108, startAngle: -90 });
    assert.equal(points.length, count);
    points.forEach(({ x, y }, i) => {
      assert.ok(Math.abs(Math.hypot(x, y) - 108) < 1e-10);
      assert.equal(sectorAt(x, y, count, -90), i);
    });
    assert.ok(Math.abs(points[0].y + 108) < 1e-10);
  });
}
test('sector boundaries use half-open intervals, center and empty are outside', () => {
  assert.equal(sectorAt(0, 0, 3), -1);
  assert.equal(sectorAt(1, 1, 0), -1);
  assert.equal(sectorAt(1, -1, 4, -90), 1);
  assert.equal(sectorAt(-1, -1, 4, -90), 0);
  assert.equal(sectorAt(1, -1.00001, 4, -90), 0);
  assert.throws(() => radialLayout(-1), RangeError);
});
