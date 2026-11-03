import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, parseRecording } from '../src/index.js';
import { fixture } from './recorder-helpers.js';

for (const redact of [true, false]) {
  test(`password input redaction ${redact}`, () => {
    const f = fixture();
    f.target.type = 'password';
    f.store.setProp('ok', 'type', ['password']);
    f.store.setProp('ok', 'value', ['initial-secret']);
    const recorder = createRecorder({ ...f, redact });
    recorder.start();
    f.target.value = 'typed-secret';
    f.fire('input');
    f.store.setProp('ok', 'value', ['typed-secret']);
    const text = recorder.stop();
    const r = parseRecording(text);
    assert.equal(r.events[0].args[2], redact ? '***' : 'typed-secret');
    assert.equal(text.includes('initial-secret'), !redact);
    assert.equal(text.includes('typed-secret'), !redact);
  });
}

test('sensitive true redacts initial, inserted and changed values', () => {
  const f = fixture();
  f.store.setProp('ok', 'sensitive', ['true']);
  const recorder = createRecorder(f);
  recorder.start();
  f.target.value = 'hidden';
  f.fire('input');
  f.store.setProp('ok', 'value', ['hidden']);
  const node = {
    id: 'secret',
    kind: 'input',
    positional: [],
    properties: [
      { name: 'sensitive', values: ['true'] },
      { name: 'value', values: ['hidden'] },
    ],
    children: [],
    unknown: [],
  };
  f.store.insert(null, 1, node);
  assert.ok(!recorder.stop().includes('hidden'));
});

test('DOM-only password metadata also hides its snapshot and later updates', () => {
  const f = fixture();
  f.target.type = 'password';
  f.root.querySelectorAll = () => [f.target];
  f.store.setProp('ok', 'value', ['initial-secret']);
  const recorder = createRecorder(f);
  recorder.start();
  f.fire('keydown', { key: 'x' });
  f.store.setProp('ok', 'value', ['later-secret']);
  const text = recorder.stop();
  assert.ok(!text.includes('secret'));
  assert.equal(parseRecording(text).events[0].args[2], '***');
});
