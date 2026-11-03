import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStreamWindow } from '../../src/chat/stream-window.js';
import { memorySource } from './helpers.js';
test('pages 50, prefetch 30, older/newer, deduplication and ceiling preserve contiguous history', async () => {
  const stream = createStreamWindow(memorySource(), { ceiling: 100 });
  assert.equal(stream.prefetch, 30);
  await stream.loadOlder();
  assert.equal(stream.state().messages[0].id, 'm150');
  await stream.loadOlder();
  await stream.loadOlder();
  assert.equal(stream.state().messages.length, 100);
  assert.equal(stream.state().messages[0].id, 'm50');
  assert.equal(stream.state().hasNewer, true);
  await stream.loadNewer();
  assert.equal(stream.state().messages.at(-1).id, 'm199');
  assert.equal(stream.state().hasOlder, true);
  const copy = stream.state();
  copy.messages.pop();
  assert.equal(stream.state().messages.length, 100);
});
test('jump loads around and highlights, exposes both directions without bridging a gap', async () => {
  const stream = createStreamWindow(memorySource());
  await stream.loadOlder();
  await stream.jumpTo('m50');
  assert.equal(stream.state().highlighted, 'm50');
  assert.equal(stream.state().messages[0].id, 'm25');
  assert.equal(stream.state().hasOlder, true);
  assert.equal(stream.state().hasNewer, true);
  await stream.loadNewer();
  assert.equal(stream.state().messages.at(-1).id, 'm124');
});
test('failed jump leaves history intact and retry clears error', async () => {
  const stream = createStreamWindow(memorySource());
  await stream.loadOlder();
  await assert.rejects(stream.jumpTo('missing'), /not found/);
  assert.equal(stream.state().messages[0].id, 'm150');
  assert.ok(stream.state().error);
  await stream.jumpTo('m50');
  assert.equal(stream.state().error, null);
});
test('jump cancels stale paging; disconnect prevents late notifications', async () => {
  const requests = [];
  const stream = createStreamWindow({
    load: (q) => new Promise((resolve) => requests.push({ q, resolve })),
  });
  let count = 0;
  stream.subscribe(() => count++);
  const first = stream.loadOlder();
  await Promise.resolve();
  const jump = stream.jumpTo('x');
  await Promise.resolve();
  assert.equal(requests[0].q.signal.aborted, true);
  requests[1].resolve({
    messages: [{ id: 'x' }],
    hasOlder: false,
    hasNewer: false,
  });
  await jump;
  requests[0].resolve({ messages: [{ id: 'stale' }] });
  await first;
  assert.equal(stream.state().messages[0].id, 'x');
  const last = stream.jumpTo('y');
  await Promise.resolve();
  stream.disconnect();
  const before = count;
  requests[2].resolve({ messages: [{ id: 'y' }] });
  await last;
  assert.equal(count, before);
});
test('empty source, malformed pages and invalid options', async () => {
  const empty = createStreamWindow(memorySource([]));
  await empty.loadOlder();
  assert.equal(empty.state().hasOlder, false);
  assert.throws(() => createStreamWindow({}, { ceiling: 1 }), RangeError);
  const invalid = createStreamWindow({
    load: async () => ({ messages: [{ id: 'x' }, { id: 'x' }] }),
  });
  await assert.rejects(invalid.loadOlder(), /Invalid stream page/);
});
test('a synchronously throwing source can be retried', async () => {
  let fail = true;
  const stream = createStreamWindow({
    load() {
      if (fail) {
        throw new Error('offline');
      }
      return Promise.resolve({
        messages: [],
        hasOlder: false,
        hasNewer: false,
      });
    },
  });
  await assert.rejects(stream.loadOlder(), /offline/);
  fail = false;
  await stream.loadOlder();
  assert.equal(stream.state().error, null);
});
