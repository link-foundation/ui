import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPositioner,
  virtualAnchor,
} from '../../src/overlays/position.js';

test('virtual anchor, middleware, updates and idempotent cleanup', async () => {
  let update;
  let resolve;
  let stops = 0;
  let calls = 0;
  const floating = { style: {} };
  const anchor = virtualAnchor(12, 24);
  const position = createPositioner({
    computePosition(a, f, options) {
      assert.equal(a, anchor);
      assert.equal(f, floating);
      assert.equal(options.strategy, 'fixed');
      assert.equal(options.placement, 'bottom-start');
      assert.equal(options.middleware.length, 3);
      return new Promise((done) => {
        resolve = done;
      });
    },
    autoUpdate(a, f, fn) {
      update = fn;
      fn();
      return () => {
        stops++;
      };
    },
  });
  const cleanup = position(anchor, floating, { onUpdate: () => calls++ });
  resolve({ x: 8, y: 9, placement: 'bottom-start' });
  await Promise.resolve();
  assert.equal(floating.style.left, '8px');
  assert.equal(calls, 1);
  update();
  cleanup();
  cleanup();
  resolve({ x: 100, y: 100 });
  await Promise.resolve();
  assert.equal(floating.style.left, '8px');
  assert.equal(stops, 1);
  assert.equal(anchor.getBoundingClientRect().left, 12);
});
