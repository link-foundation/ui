import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, verifyReplay } from '../src/index.js';
import { fixture, makeStore } from './recorder-helpers.js';

test('input-only replay proves deterministic diffs and catches Date.now use', async () => {
  const f = fixture();
  const recorder = createRecorder(f);
  recorder.start();
  f.clock.advance(20);
  f.fire('pointerdown');
  f.store.setProp('ok', 'label', ['Saved']);
  const recording = recorder.stop();
  for (const deterministic of [true, false]) {
    let disposed = false;
    const result = await verifyReplay(recording, {
      createApp(seed, clock) {
        assert.equal(seed, 42);
        const store = makeStore();
        return {
          store,
          dispatchInput() {
            assert.equal(clock.now(), 20);
            store.setProp('ok', 'label', [
              deterministic ? 'Saved' : String(Date.now()),
            ]);
          },
          dispose() {
            disposed = true;
          },
        };
      },
    });
    assert.equal(result.ok, deterministic);
    assert.equal(result.mismatches.length, deterministic ? 0 : 1);
    assert.equal(disposed, true);
  }
});

test('verification records with the same redaction policy', async () => {
  const f = fixture();
  f.store.setProp('ok', 'sensitive', ['true']);
  const recorder = createRecorder(f);
  recorder.start();
  f.fire('pointerdown');
  f.store.setProp('ok', 'value', ['secret']);
  const result = await verifyReplay(recorder.stop(), {
    createApp() {
      const store = makeStore();
      return {
        store,
        dispatchInput() {
          store.setProp('ok', 'value', ['secret']);
        },
      };
    },
  });
  assert.equal(result.ok, true);
});
