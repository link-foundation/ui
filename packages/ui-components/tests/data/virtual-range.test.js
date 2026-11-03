import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  listOffsets,
  indexAt,
  listRange,
  anchorScrollTop,
} from '../../src/data/virtual-range.js';

for (const count of [0, 1, 10, 100000]) {
  test(`offsets and binary search for ${count} items`, () => {
    const offsets = listOffsets({ count, estimate: 20, measured: new Map() });
    assert.equal(offsets.length, count + 1);
    assert.equal(offsets[count], count * 20);
    assert.equal(indexAt(offsets, 0), count ? 0 : -1);
    assert.equal(indexAt(offsets, Infinity), count - 1);
    if (count) {
      assert.equal(indexAt(offsets, count * 20 - 1), count - 1);
    }
  });
}
test('variable heights, exact boundaries and one-screen overscan', () => {
  const offsets = listOffsets({
    count: 10,
    estimate: 10,
    measured: new Map([[1, 30]]),
  });
  assert.equal(indexAt(offsets, 10), 1);
  assert.equal(indexAt(offsets, 39), 1);
  assert.equal(indexAt(offsets, 40), 2);
  assert.deepEqual(listRange(offsets, 40, 20), { start: 1, end: 6 });
  assert.deepEqual(listRange(offsets, 40, 20, 0), { start: 2, end: 4 });
  assert.deepEqual(listRange(new Float64Array([0]), 0, 100), {
    start: 0,
    end: 0,
  });
});
test('keyed anchor preserves its intra-row position after prepend and measurement', () => {
  const before = {
    keys: ['a', 'b'],
    offsets: new Float64Array([0, 20, 50]),
    scrollTop: 25,
  };
  const after = {
    keys: ['x', 'a', 'b'],
    offsets: new Float64Array([0, 10, 35, 65]),
  };
  assert.equal(anchorScrollTop(before, after, 'b'), 40);
  assert.equal(anchorScrollTop(before, after, 'missing'), 25);
});
test('invalid sizes cannot poison offsets', () => {
  assert.throws(() => listOffsets({ count: -1, estimate: 10 }), RangeError);
  assert.throws(() => listOffsets({ count: 1, estimate: 0 }), RangeError);
  assert.deepEqual(
    [
      ...listOffsets({
        count: 2,
        estimate: 10,
        measured: new Map([
          [0, NaN],
          [1, -1],
        ]),
      }),
    ],
    [0, 10, 20]
  );
});
