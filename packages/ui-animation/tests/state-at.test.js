import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, stateAt, replay } from '../src/index.js';
import { fixture, makeStore } from './recorder-helpers.js';
import { restoreStore } from '../src/recorder/store.js';

test('state at 900 and 990, with repeated backward seek', () => {
  const f = fixture();
  const recorder = createRecorder(f);
  recorder.start();
  f.store.setProp('ok', 'label', ['OK']);
  f.clock.advance(990);
  f.store.setProp('ok', 'label', ['Saved']);
  const text = recorder.stop();
  const store = makeStore();
  restoreStore(store, stateAt(text, 900));
  assert.deepEqual(store.get('ok').properties[0].values, ['OK']);
  restoreStore(store, stateAt(text, 990));
  assert.deepEqual(store.get('ok').properties[0].values, ['Saved']);
  const control = replay(text, { store, clock: f.clock });
  control.seek(990);
  const end = store.toDocument();
  control.seek(0);
  control.seek(990);
  assert.deepEqual(store.toDocument(), end);
});

test('all committed operation shapes preserve stable IDs and exact properties', () => {
  const f = fixture();
  const recorder = createRecorder(f);
  recorder.start();
  f.store.insert(null, 1, {
    id: null,
    kind: 'text',
    positional: ['Hi'],
    properties: [],
    children: [],
    unknown: [],
  });
  const id = f.store.roots()[1];
  f.store.setPositional(id, ['Changed']);
  f.store.setProp(id, 'custom', [['nested', 'value']]);
  f.store.apply({
    op: 'setProp',
    id,
    name: 'custom',
    values: ['first'],
    index: 0,
  });
  f.store.removeProp(id, 'custom');
  f.store.move(id, 'ok', 0);
  f.store.rename(id, 'renamed');
  f.store.removeProp('ok', 'label');
  const end = f.store.toDocument();
  const text = recorder.stop();
  const store = makeStore();
  restoreStore(store, stateAt(text, 0));
  assert.deepEqual(store.toDocument(), end);
  assert.equal(store.children('ok')[0], 'renamed');
});
