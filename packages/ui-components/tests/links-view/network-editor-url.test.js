import { it } from 'node:test';
import assert from 'node:assert/strict';
import { syncNetworkUrl } from '../../src/links-view/network-editor/url-sync.js';
import { JSDOM } from 'jsdom';

function setup(fail = false) {
  const { window } = new JSDOM('', { url: 'https://example.test/' });
  const { document } = window;
  const input = document.createElement('input');
  input.type = 'range';
  document.body.append(input);
  const jobs = new Map();
  let now = 0;
  let sequence = 0;
  let listener;
  const calls = [];
  const replaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args) => {
    calls.push(now);
    if (fail) {
      throw new window.DOMException('rate limit', 'SecurityError');
    }
    replaceState(...args);
  };
  const sync = syncNetworkUrl(
    {
      subscribe: (fn) => {
        listener = fn;
        return () => {
          listener = null;
        };
      },
    },
    {
      window,
      urlFor: () => 'https://example.test/?x=1',
      setTimer: (fn, delay) => {
        const id = ++sequence;
        jobs.set(id, { fn, time: now + delay });
        return id;
      },
      clearTimer: (id) => jobs.delete(id),
    }
  );
  const tick = (ms) => {
    const until = now + ms;
    while ([...jobs.values()].some((job) => job.time <= until)) {
      const [id, job] = [...jobs].sort((a, b) => a[1].time - b[1].time)[0];
      jobs.delete(id);
      now = job.time;
      job.fn();
    }
    now = until;
  };
  return { window, input, tick, calls, sync, update: () => listener({}), jobs };
}
it('defers a 2 second slider drag and writes exactly once 400 ms after release', () => {
  const s = setup();
  s.input.dispatchEvent(new s.window.Event('pointerdown', { bubbles: true }));
  for (let i = 0; i < 20; i++) {
    s.update();
    s.tick(100);
  }
  assert.deepEqual(s.calls, []);
  s.window.dispatchEvent(new s.window.Event('pointerup'));
  s.tick(399);
  assert.equal(s.calls.length, 0);
  s.tick(1);
  assert.deepEqual(s.calls, [2400]);
  s.sync.dispose();
  s.window.close();
});
it('releases a held slider key on focusout and skips repeated unchanged URLs', () => {
  const s = setup();
  s.input.focus();
  s.input.dispatchEvent(
    new s.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  s.update();
  s.tick(500);
  s.input.blur();
  s.update();
  s.tick(400);
  assert.deepEqual(s.calls, [900]);
  s.update();
  s.tick(400);
  assert.deepEqual(s.calls, [900]);
  s.sync.dispose();
  s.window.close();
});

it('releases a removed keyboard control even when focusout is not dispatched', async () => {
  const s = setup();
  s.input.dispatchEvent(
    new s.window.KeyboardEvent('keydown', { key: 'End', bubbles: true })
  );
  s.update();
  s.input.remove();
  await Promise.resolve();
  s.tick(400);
  assert.deepEqual(s.calls, [400]);
  s.sync.dispose();
  s.window.close();
});
it('survives SecurityError, backs off and gives up after five failures', () => {
  const s = setup(true);
  s.update();
  s.tick(20_000);
  assert.deepEqual(s.calls, [400, 1400, 3400, 7400, 15400]);
  assert.equal(s.jobs.size, 0);
  s.sync.dispose();
  s.window.close();
});
it('slider keys, touch cancellation and disposal release held writes', () => {
  const s = setup();
  s.input.dispatchEvent(
    new s.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  s.update();
  s.tick(2000);
  assert.equal(s.calls.length, 0);
  s.window.dispatchEvent(
    new s.window.KeyboardEvent('keyup', { key: 'ArrowRight' })
  );
  s.tick(400);
  assert.equal(s.calls.length, 1);
  s.update();
  s.sync.dispose();
  s.tick(1000);
  assert.equal(s.calls.length, 1);
  s.window.close();
});
it('touch cancellation releases only its held input and permits the pending commit', () => {
  const s = setup();
  const touch = (target, name) => {
    const event = new s.window.Event(name, { bubbles: true });
    Object.defineProperty(event, 'changedTouches', {
      value: [{ identifier: 7 }],
    });
    target.dispatchEvent(event);
  };
  touch(s.input, 'touchstart');
  s.update();
  s.tick(2000);
  assert.deepEqual(s.calls, []);
  touch(s.window, 'touchcancel');
  s.tick(400);
  assert.deepEqual(s.calls, [2400]);
  s.sync.dispose();
  s.window.close();
});
