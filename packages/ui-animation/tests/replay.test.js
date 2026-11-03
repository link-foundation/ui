import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecorder,
  replay,
  createPlayer,
  animationsAt,
  sample,
  loadAnimations,
} from '../src/index.js';
import { fixture, makeStore } from './recorder-helpers.js';

const source =
  'reveal: animation\n  target ok\n  duration 1000ms\n  effect decipher\n';
test('two replays reproduce snapshots and seed 42 samples at every event time', async () => {
  const f = fixture();
  const player = createPlayer(null, {
    clock: f.clock,
    seed: 42,
    animations: source,
  });
  const recorder = createRecorder({ ...f, player });
  recorder.start();
  player.play('reveal', { target: 'ok', input: 'Hello links' });
  f.clock.advance(100);
  recorder.mark('first');
  f.clock.advance(100);
  f.store.setProp('ok', 'label', ['Saved']);
  const text = recorder.stop();
  const collect = async () => {
    const store = makeStore();
    const clock = fixture().clock;
    const p = createPlayer(null, { clock, animations: source });
    const control = replay(text, { store, player: p, clock });
    const done = control.play();
    const frames = [];
    for (const delta of [0, 100, 100]) {
      clock.advance(delta);
      frames.push({
        document: store.toDocument(),
        values: animationsAt(text, control.time).map((run) =>
          sample(p.model.animations.get(run.id), run.time, {
            seed: run.seed,
            input: run.input,
          })
        ),
      });
    }
    await done;
    assert.equal(clock.pending, 0);
    return frames;
  };
  const first = await collect();
  assert.deepEqual(await collect(), first);
  assert.deepEqual(
    first[1].values[0],
    sample(loadAnimations(source).animations.get('reveal'), 100, {
      seed: 42,
      input: 'Hello links',
    })
  );
});

test('manual clock runs due events at exact times and ties in file order', () => {
  const { clock } = fixture();
  const seen = [];
  clock.setTimeout(() => seen.push([clock.now(), 1]), 5);
  clock.setTimeout(() => seen.push([clock.now(), 2]), 5);
  clock.setTimeout(() => seen.push([clock.now(), 3]), 9);
  clock.advance(20);
  assert.deepEqual(seen, [
    [5, 1],
    [5, 2],
    [9, 3],
  ]);
  assert.throws(() => clock.advance(-1), RangeError);
});

test('timed replay uses replay origin so store triggers do not duplicate recorded plays', async () => {
  const f = fixture();
  const recorder = createRecorder(f);
  recorder.start();
  f.clock.advance(10);
  f.store.setProp('ok', 'pressed', ['true']);
  recorder.mark('end');
  const text = recorder.stop();
  const store = makeStore();
  const clock = fixture().clock;
  const player = createPlayer(null, {
    clock,
    animations:
      'feedback: animation\n  target ok\n  duration 100ms\n  on pressed\n',
  });
  player.bindTriggers(store);
  const plays = [];
  player.subscribe((e) => plays.push(e));
  const control = replay(text, { store, player, clock });
  const done = control.play();
  clock.advance(10);
  await done;
  assert.deepEqual(plays, []);
});

test('seeking after completion cancels a filled effect before restoring the snapshot', () => {
  const f = fixture();
  const node = { textContent: 'original' };
  const player = createPlayer(() => node, {
    clock: f.clock,
    animations:
      'fill: animation\n  target ok\n  duration 10ms\n  fill forwards\n  effect decipher\n',
  });
  const control = player.play('fill', { input: 'finished', seed: 42 });
  f.clock.advance(20);
  assert.equal(node.textContent, 'finished');
  control.cancel();
  assert.equal(node.textContent, 'original');
});
