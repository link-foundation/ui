import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, parseRecording, createPlayer } from '../src/index.js';
import { fixture } from './recorder-helpers.js';

test('scripted session captures exact relative times, inputs and player hooks', () => {
  const f = fixture();
  const player = createPlayer(null, {
    clock: f.clock,
    animations: 'press-feedback: animation\n  duration 150ms\n',
  });
  const recorder = createRecorder({ ...f, player });
  recorder.start();
  f.store.setProp('ok', 'label', ['OK']);
  f.clock.advance(840);
  f.fire('pointerdown');
  f.clock.advance(1);
  player.play('press-feedback', { target: 'ok' });
  f.clock.advance(149);
  f.store.setProp('ok', 'label', ['Saved']);
  const r = parseRecording(recorder.stop());
  assert.deepEqual(
    r.events.map(({ time, kind }) => [time, kind]),
    [
      [0, 'set'],
      [840, 'input'],
      [841, 'play'],
      [990, 'set'],
    ]
  );
  assert.deepEqual(r.events[1].args.slice(0, 4), [
    'pointer',
    'down',
    'ok',
    ['at', '12', '8'],
  ]);
  assert.equal(r.seed, 42);
  f.store.setProp('ok', 'label', ['later']);
  assert.equal(recorder.size(), 4);
});

test('1000 pointer moves within one second yield at most 60 moves', () => {
  const f = fixture();
  const recorder = createRecorder(f);
  recorder.start();
  for (let i = 0; i < 1000; i++) {
    f.fire('pointermove');
    f.clock.advance(1);
  }
  assert.equal(parseRecording(recorder.stop()).events.length, 60);
});

test('text coalesces per field and bounded ring retains newest events', () => {
  const f = fixture();
  const recorder = createRecorder({ ...f, maxEvents: 2 });
  recorder.start();
  f.target.value = 'a';
  f.fire('input');
  f.target.value = 'ab';
  f.fire('input');
  assert.equal(recorder.size(), 1);
  recorder.mark('one');
  recorder.mark('two');
  const r = parseRecording(recorder.stop());
  assert.equal(r.truncated, true);
  assert.deepEqual(
    r.events.map((e) => e.args),
    [['one'], ['two']]
  );
});

test('cancel identifies its play invocation', () => {
  const f = fixture();
  const player = createPlayer(null, {
    clock: f.clock,
    animations: 'a: animation\n  duration 100ms\n',
  });
  const recorder = createRecorder({ ...f, player });
  recorder.start();
  const control = player.play('a');
  f.clock.advance(5);
  control.cancel();
  const events = parseRecording(recorder.stop()).events;
  assert.deepEqual(
    events.map((e) => e.kind),
    ['play', 'cancel']
  );
  assert.deepEqual(events[0].args[1], events[1].args[1]);
});

test('capture includes keys, wheel and focus events in file order', () => {
  const f = fixture();
  const recorder = createRecorder(f);
  recorder.start();
  f.fire('keydown', { key: 'Enter' });
  f.fire('keyup', { key: 'Enter' });
  f.fire('wheel', { deltaX: 2, deltaY: -4, deltaMode: 1 });
  f.fire('focusin');
  f.fire('focusout');
  assert.deepEqual(
    parseRecording(recorder.stop()).events.map((e) => e.args),
    [
      ['key', 'down', 'Enter', ['target', 'ok']],
      ['key', 'up', 'Enter', ['target', 'ok']],
      ['wheel', 'ok', '2', '-4', '1'],
      ['focus', 'in', 'ok'],
      ['focus', 'out', 'ok'],
    ]
  );
});
