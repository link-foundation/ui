import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeToX, xToTime, snapTime } from '../src/timeline/scale.js';
test('time and pixels round trip at several zooms and scroll positions', () => {
  for (const zoom of [0.05, 0.2, 1, 4]) {
    for (const scroll of [0, 120, 900]) {
      for (const x of [0, 7, 923]) {
        assert.ok(
          Math.abs(
            timeToX(xToTime(x, { zoom, scroll }), { zoom, scroll }) - x
          ) < 0.5
        );
      }
    }
  }
});
test('snap chooses nearest playhead/key candidate or frame only within threshold', () => {
  assert.equal(
    snapTime(898, { fps: 60, candidates: [900], threshold: 5 }),
    900
  );
  assert.equal(
    snapTime(34, { fps: 60, candidates: [], threshold: 3 }),
    1000 / 30
  );
  assert.equal(snapTime(42, { fps: 60, candidates: [], threshold: 1 }), 42);
});
