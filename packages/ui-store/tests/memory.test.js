import { describe, it } from 'test-anywhere';
import { strictEqual } from 'node:assert';
import * as memory from '@link-foundation/ui-store/memory';
import {
  createStore,
  DEFAULT_ORIGIN,
  GENERATED_ID_PREFIX,
  openDoubletsWeb,
  copyToDoubletsWeb,
} from '@link-foundation/ui-store';

describe('in-memory entry', () => {
  it('shares the store implementation and ID prefix with the public root', () => {
    strictEqual(memory.createStore, createStore);
    strictEqual(memory.DEFAULT_ORIGIN, DEFAULT_ORIGIN);
    strictEqual(memory.GENERATED_ID_PREFIX, GENERATED_ID_PREFIX);
    const store = memory.createStore({ text: "text 'Anonymous'" });
    strictEqual(store.roots()[0].startsWith(memory.GENERATED_ID_PREFIX), true);
  });

  it('keeps the explicit WASM adapter exports on the root entry', () => {
    strictEqual(typeof openDoubletsWeb, 'function');
    strictEqual(typeof copyToDoubletsWeb, 'function');
  });
});
