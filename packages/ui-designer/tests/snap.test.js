import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSnap } from '../src/snap.js';

for (const [name, moving, expected] of [
  ['left', { x: 104, y: 250, width: 20, height: 20 }, -4],
  ['right', { x: 144, y: 250, width: 50, height: 20 }, 6],
  ['centre', { x: 137, y: 250, width: 20, height: 20 }, 3],
]) {
  test(`snaps ${name} within the inclusive default 6 CSS pixel threshold`, () => {
    const result = computeSnap(moving, [
      { x: 100, y: 100, width: 100, height: 100 },
    ]);
    assert.equal(result.dx, expected);
    assert.equal(result.guides[0].axis, 'x');
  });
}
test('snaps middle and rejects distances outside configured threshold', () => {
  const other = { x: 100, y: 100, width: 100, height: 100 };
  assert.equal(
    computeSnap({ x: 300, y: 143, width: 20, height: 20 }, [other]).dy,
    -3
  );
  assert.deepEqual(
    computeSnap({ x: 107, y: 300, width: 20, height: 20 }, [other]),
    { dx: 0, dy: 0, guides: [] }
  );
  assert.equal(
    computeSnap({ x: 107, y: 300, width: 20, height: 20 }, [other], {
      threshold: 8,
    }).dx,
    -7
  );
});
