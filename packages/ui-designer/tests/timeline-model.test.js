import { test } from 'node:test';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import {
  readTimeline,
  moveKeyframe,
  insertKeyframe,
  deleteKeyframe,
  moveEvent,
} from '../src/timeline/model.js';
const text = readFileSync(
  new URL('./fixtures/animation.lino', import.meta.url),
  'utf8'
);
test('sample tree resolves token duration, three scale keys and three recording events', () => {
  const model = readTimeline(parse(text), () => 1000);
  assert.equal(model.animations.length, 1);
  assert.equal(model.animations[0].durationMs, 1000);
  assert.equal(model.animations[0].target, 'ok');
  assert.deepEqual(
    model.animations[0].tracks[0].keys.map((k) => [k.offset, k.value]),
    [
      [0, '1'],
      [0.5, '0.96'],
      [1, '1'],
    ]
  );
  assert.equal(model.recordings[0].events.length, 3);
  assert.equal(model.recordings[0].events[1].timeMs, 840);
});
test('key operations are immutable, sorted, clamped and reject duplicate offsets', () => {
  const track = {
    property: 'scale',
    keys: [
      { offset: 0, value: '1' },
      { offset: 0.5, value: '2' },
      { offset: 1, value: '3' },
    ],
  };
  assert.equal(moveKeyframe(track, 1, 0.4).keys[1].offset, 0.4);
  assert.equal(moveKeyframe(track, 0, -1).keys[0].offset, 0);
  assert.equal(moveKeyframe(track, 2, 3).keys[2].offset, 1);
  assert.throws(() => moveKeyframe(track, 1, 1), /duplicate/i);
  assert.throws(() => insertKeyframe(track, 0, '4'), /duplicate/i);
  assert.equal(insertKeyframe(track, 0.25, '4').keys[1].value, '4');
  assert.equal(deleteKeyframe(track, 0).keys.length, 2);
  assert.throws(() => deleteKeyframe(deleteKeyframe(track, 0), 0), /two/i);
  assert.equal(track.keys[1].offset, 0.5);
  assert.throws(() => moveKeyframe(track, 1, NaN), /finite/i);
  assert.deepEqual(
    moveEvent({ events: [{ timeMs: 20 }, { timeMs: 50 }] }, 1, -4).events.map(
      (e) => e.timeMs
    ),
    [0, 20]
  );
});

test('embedded timeline layout matches its LiNo source', async () => {
  const { TIMELINE_LAYOUT } = await import('../src/timeline/layout-text.js');
  assert.equal(
    TIMELINE_LAYOUT,
    readFileSync(
      new URL('../src/timeline/timeline.lino', import.meta.url),
      'utf8'
    )
  );
});
