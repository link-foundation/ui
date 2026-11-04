import { test } from 'node:test';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDocumentSession } from '../src/sync.js';
import { timelineEdit, runTimelineCommand } from '../src/timeline/commands.js';
import { readTimeline } from '../src/timeline/model.js';
const text = readFileSync(
  new URL('./fixtures/animation.lino', import.meta.url),
  'utf8'
);
test('moving the middle key changes only its offset; each edit is one undo/redo', () => {
  const session = createDocumentSession(text);
  runTimelineCommand(session, {
    type: 'key-move',
    id: 'press-feedback',
    index: 1,
    offset: 0.4,
  });
  assert.equal(session.getText(), text.replace('key 0.5 0.96', 'key 0.4 0.96'));
  assert.equal(session.store.log().length, 1);
  session.undo();
  assert.equal(session.getText(), text);
  session.redo();
  assert.ok(session.getText().includes('key 0.4 0.96'));
  session.destroy();
});
test('recording event 840 to 900 changes only the time atom and preserves its action', () => {
  assert.equal(
    timelineEdit(text, {
      type: 'event-move',
      id: 'recording-1',
      index: 1,
      ms: 900,
    }),
    text.replace('840ms', '900ms')
  );
});
test('insert, delete, value, easing, duration and event actions use parsed source spans', () => {
  const key = { id: 'press-feedback', index: 1 };
  let next = timelineEdit(text, {
    ...key,
    type: 'key-insert',
    offset: 0.25,
    value: '0.98',
  });
  assert.equal(readTimeline(next).animations[0].tracks[0].keys.length, 4);
  next = timelineEdit(next, { ...key, type: 'key-delete' });
  assert.equal(readTimeline(next).animations[0].tracks[0].keys.length, 3);
  next = timelineEdit(next, { ...key, type: 'key-value', value: '0.95' });
  next = timelineEdit(next, { ...key, type: 'key-easing', value: 'linear' });
  assert.ok(next.includes('key 0.5 0.95 linear'));
  assert.throws(
    () => timelineEdit(text, { id: key.id, type: 'duration', ms: 1200 }),
    /confirmation/
  );
  next = timelineEdit(next, {
    id: key.id,
    type: 'duration',
    ms: 1200,
    replaceToken: true,
  });
  assert.equal(readTimeline(next).animations[0].durationMs, 1200);
  next = timelineEdit(next, {
    id: 'recording-1',
    type: 'event-action',
    index: 1,
    value: 'mark Changed',
  });
  assert.deepEqual(readTimeline(next).recordings[0].events[1].action, [
    'mark',
    'Changed',
  ]);
  next = timelineEdit(next, {
    id: 'recording-1',
    type: 'event-delete',
    index: 1,
  });
  assert.equal(readTimeline(next).recordings[0].events.length, 2);
});

test('crossing keys and events stay sorted with their values and actions', () => {
  const base = text.replace('key 0.5 0.96', 'key 0.5 0.96\n    key 0.8 0.98');
  const moved = timelineEdit(base, {
    type: 'key-move',
    id: 'press-feedback',
    index: 1,
    offset: 0.9,
  });
  assert.deepEqual(
    readTimeline(moved).animations[0].tracks[0].keys.map((k) => [
      k.offset,
      k.value,
    ]),
    [
      [0, '1'],
      [0.8, '0.98'],
      [0.9, '0.96'],
      [1, '1'],
    ]
  );
  const event = timelineEdit(text, {
    type: 'event-move',
    id: 'recording-1',
    index: 1,
    ms: 1200,
  });
  assert.deepEqual(
    readTimeline(event).recordings[0].events.map((e) => e.timeMs),
    [0, 990, 1200]
  );
  assert.deepEqual(readTimeline(event).recordings[0].events[2].action, [
    'input',
    'pointer',
    'down',
    'ok',
  ]);
});
test('comments, inline input and an entire group gesture preserve surrounding source and undo once', () => {
  const inline =
    'a: animation (target ok) (duration 1000ms) (track scale (key 0 1) (key 0.5 0.96) (key 1 1))\n';
  assert.equal(
    timelineEdit(inline, { type: 'key-move', id: 'a', index: 1, offset: 0.4 }),
    inline.replace('key 0.5', 'key 0.4')
  );
  const commented = text.replace(
    '    key 0.5 0.96',
    '    # middle\n    key 0.5 0.96 # keep me'
  );
  assert.equal(
    timelineEdit(commented, {
      type: 'key-move',
      id: 'press-feedback',
      index: 1,
      offset: 0.4,
    }),
    commented.replace('key 0.5', 'key 0.4')
  );
  const session = createDocumentSession(text);
  runTimelineCommand(session, [
    { type: 'key-value', id: 'press-feedback', index: 1, value: '0.95' },
    { type: 'event-move', id: 'recording-1', index: 1, ms: 900 },
  ]);
  assert.equal(session.store.log().length, 1);
  session.undo();
  assert.equal(session.getText(), text);
  assert.throws(
    () =>
      runTimelineCommand(session, [
        { type: 'key-value', id: 'press-feedback', index: 1, value: '0.95' },
        { type: 'key-move', id: 'press-feedback', index: 1, offset: 1 },
      ]),
    /Duplicate/
  );
  assert.equal(session.getText(), text);
  session.destroy();
});
test('events can be added before and after existing events, or to an empty recording', () => {
  for (const ms of [100, 1500]) {
    const next = timelineEdit(text, {
      id: 'recording-1',
      type: 'event-insert',
      ms,
    });
    assert.deepEqual(
      readTimeline(next).recordings[0].events.map((e) => e.timeMs),
      [0, 840, 990, ms].sort((a, b) => a - b)
    );
  }
  const next = timelineEdit('r: recording\n', {
    id: 'r',
    type: 'event-insert',
    ms: 100,
  });
  assert.equal(readTimeline(next).recordings[0].events[0].timeMs, 100);
});

test('inserting events preserves inline and parenthesized recording membership', () => {
  for (const source of [
    'r: recording (event 0ms (mark A)) (event 990ms (mark B))\n',
    '(r: recording (event 0ms (mark A)) (event 990ms (mark B)))\n',
    '(r: recording)\n',
  ]) {
    for (const ms of [500, 1500]) {
      const next = timelineEdit(source, { id: 'r', type: 'event-insert', ms });
      const events = readTimeline(next).recordings[0].events;
      assert.deepEqual(
        events.map((event) => event.timeMs),
        source.includes('990ms') ? [0, 990, ms].sort((a, b) => a - b) : [ms]
      );
    }
  }
});
