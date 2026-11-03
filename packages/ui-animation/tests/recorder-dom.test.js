import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRecorder, parseRecording } from '../src/index.js';
import { fixture } from './recorder-helpers.js';

test('input fixture works when another suite installs a different Event realm', () => {
  const other = new JSDOM();
  const original = globalThis.Event;
  try {
    globalThis.Event = other.window.Event;
    const f = fixture();
    const recorder = createRecorder(f);
    recorder.start();
    f.fire('pointerdown');
    assert.equal(parseRecording(recorder.stop()).events.length, 1);
  } finally {
    globalThis.Event = original;
    other.window.close();
  }
});
