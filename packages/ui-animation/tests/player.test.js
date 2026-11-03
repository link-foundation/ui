/**
 * `createPlayer`: WAAPI for CSS tracks, a clock-driven frame loop for
 * effects, reduced motion and state triggers. A manual clock and a fake
 * `animate` make every run deterministic, with no DOM.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import {
  createManualClock,
  createPlayer,
  decipher,
  defaultMotion,
  loadAnimations,
  triggersFor,
} from '@link-foundation/ui-animation';
import { SAMPLE_TEXT, STEP_2_TEXT, resolveToken } from './helpers.js';

/** A minimal element: text, attributes and a `[data-motion]` boundary. */
function fakeElement(id, { text = '', motion = null } = {}) {
  const attributes = new Map();
  return {
    id,
    textContent: text,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
    closest: (selector) =>
      selector === '[data-motion]' && motion
        ? { getAttribute: () => motion }
        : null,
  };
}

/** A fake `element.animate` that records calls and follows the clock. */
function fakeAnimate(clock) {
  const calls = [];
  const animate = (element, keyframes, options) => {
    const started = clock.now();
    const length =
      (options.delay ?? 0) + options.duration * (options.iterations ?? 1);
    const call = {
      element,
      keyframes,
      options,
      currentTime: null,
      state: 'running',
    };
    call.finished = new Promise((resolve, reject) => {
      const check = () => {
        if (call.state === 'cancelled') {
          reject(new Error('cancelled'));
        } else if (clock.now() - started >= length) {
          call.state = 'finished';
          resolve(call);
        } else {
          clock.requestFrame(check);
        }
      };
      check();
    });
    call.pause = () => (call.state = 'paused');
    call.play = () => (call.state = 'running');
    call.cancel = () => (call.state = 'cancelled');
    calls.push(call);
    return call;
  };
  return { animate, calls };
}

/** Lets settled promises run their callbacks. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(text, options = {}) {
  const clock = createManualClock();
  const { animate, calls } = fakeAnimate(clock);
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, fakeElement(id, options.elements?.[id]));
    }
    return elements.get(id);
  };
  const player = createPlayer(element, {
    animations: text,
    clock,
    animate,
    resolveToken,
    motion: 'full',
    ...options.player,
  });
  return { clock, calls, element, player };
}

describe('createPlayer: play', () => {
  it('plays press-feedback through WAAPI with the step-6 arguments', () => {
    const { calls, element, player } = setup(SAMPLE_TEXT);
    player.play('press-feedback');
    expect(calls.length).toBe(1);
    expect(calls[0].element).toBe(element('ok'));
    expect(calls[0].keyframes).toEqual([
      { offset: 0, scale: '1' },
      { offset: 0.5, scale: '0.96' },
      { offset: 1, scale: '1' },
    ]);
    expect(calls[0].options).toEqual({
      duration: 150,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'none',
      composite: 'replace',
    });
  });

  it('seeks deterministically', () => {
    const linear = SAMPLE_TEXT.replace(
      '  easing standard\n',
      '  easing linear\n'
    );
    for (let round = 0; round < 3; round++) {
      const { calls, player } = setup(linear);
      const run = player.play('press-feedback');
      run.seek(75);
      expect(run.currentTime).toBe(75);
      expect(calls[0].currentTime).toBe(75);
      expect(run.values()).toEqual({ scale: 0.96 });
    }
  });

  it('resolves finished when the clock reaches the end, not before', async () => {
    const { clock, player } = setup(SAMPLE_TEXT);
    const run = player.play('press-feedback');
    let done = false;
    run.finished.then(() => (done = true));
    clock.advance(100);
    await flush();
    expect(done).toBe(false);
    clock.advance(50);
    await flush();
    expect(done).toBe(true);
    expect(clock.pending).toBe(0);
  });

  it('settles the frame loop on a seek to the end and waits for WAAPI', async () => {
    const { clock, player } = setup(SAMPLE_TEXT);
    const run = player.play('press-feedback');
    run.seek(150);
    clock.advance(1);
    let done = false;
    run.finished.then(() => (done = true));
    await flush();
    // The fake WAAPI animation still follows the clock.
    expect(done).toBe(false);
    clock.advance(149);
    await flush();
    expect(done).toBe(true);
  });

  it('pauses, resumes and cancels', async () => {
    const { clock, calls, player } = setup(SAMPLE_TEXT);
    const run = player.play('press-feedback');
    clock.advance(50);
    run.pause();
    expect(calls[0].state).toBe('paused');
    clock.advance(500);
    expect(run.currentTime).toBe(50);
    run.play();
    expect(calls[0].state).toBe('running');
    clock.advance(20);
    expect(Math.round(run.currentTime)).toBe(70);
    run.cancel();
    expect(calls[0].state).toBe('cancelled');
    let error = null;
    await run.finished.catch((e) => (error = e));
    expect(error.name).toBe('AbortError');
  });

  it('plays a timeline: at, stagger and targets', () => {
    const { calls, element, player } = setup(STEP_2_TEXT);
    const run = player.play('intro');
    expect(
      calls.map((c) => [c.element.id, c.options.delay ?? 0, c.options.duration])
    ).toEqual([
      ['sidebar', 0, 300],
      ['item-1', 120, 600],
      ['item-2', 170, 600],
      ['item-3', 220, 600],
    ]);
    expect(run.runs.map((r) => r.end)).toEqual([300, 720, 770, 820]);
    expect(calls[0].element).toBe(element('sidebar'));
  });

  it('runs effects in the frame loop and restores the text', async () => {
    const { clock, calls, player } = setup(STEP_2_TEXT, {
      elements: { title: { text: 'Hello world' } },
    });
    const run = player.play('title-reveal');
    expect(calls.length).toBe(0);
    clock.advance(450);
    const element = run.runs[0].element;
    expect(element.textContent).toBe(decipher('Hello world', 0.5, 42));
    clock.advance(450);
    await run.finished;
    expect(element.textContent).toBe('Hello world');
  });

  it('rejects an unknown id', () => {
    const { player } = setup(SAMPLE_TEXT);
    expect(() => player.play('nothing')).toThrow();
  });
});

describe('createPlayer: reduced motion', () => {
  it('plays the (reduced-motion ...) block instead', () => {
    const { calls, player } = setup(STEP_2_TEXT, {
      player: { motion: 'reduced' },
    });
    player.play('panel-enter', { target: 'sidebar' });
    expect(calls[0].options.duration).toBe(0);
    expect(calls[0].keyframes.length).toBe(2);
  });

  it('keeps only opacity tracks at duration 0 without a block', async () => {
    const text = `${STEP_2_TEXT}
(pop: animation (target card) (duration 400ms)
  (track scale (key 0 0.8) (key 1 1))
  (track opacity (key 0 0) (key 1 1)))`;
    const { calls, clock, player } = setup(text, {
      player: { motion: 'reduced' },
    });
    const bounce = player.play('bounce', { target: 'x' });
    expect(calls.length).toBe(0);
    clock.advance(1);
    await bounce.finished;
    player.play('pop');
    expect(calls[0].keyframes).toEqual([
      { offset: 0, opacity: '0' },
      { offset: 1, opacity: '1' },
    ]);
    expect(calls[0].options.duration).toBe(0);
  });

  it('switches by element: data-motion or prefers-reduced-motion', () => {
    const { calls, player } = setup(STEP_2_TEXT, {
      player: { motion: defaultMotion },
      elements: { calm: { motion: 'reduced' }, busy: { motion: 'full' } },
    });
    player.play('panel-enter', { target: 'calm' });
    player.play('panel-enter', { target: 'busy' });
    expect(calls.map((c) => c.options.duration)).toEqual([0, 300]);
    expect(player.motion('calm')).toBe('reduced');

    const saved = globalThis.matchMedia;
    globalThis.matchMedia = (query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    });
    try {
      expect(player.motion('busy')).toBe('reduced');
    } finally {
      globalThis.matchMedia = saved;
    }
  });
});

describe('createPlayer: bindTriggers', () => {
  const ANIMATIONS = `(press: animation (target ok) (duration 100ms)
  (track scale (key 0 1) (key 0.5 0.96) (key 1 1))
  (on pressed))
(glow: animation (duration 200ms)
  (track opacity (key 0 1) (key 1 0.8)))`;

  it('plays on state changes and stops after unsubscribe', () => {
    const { calls, player } = setup(ANIMATIONS);
    const store = createStore({
      text: "(ok: button (label 'OK') (on hover (play glow)))\n(other: button)",
    });
    const unsubscribe = player.bindTriggers(store);
    store.setProp('ok', 'pressed', ['true']);
    expect(calls.map((c) => [c.element.id, c.options.duration])).toEqual([
      ['ok', 100],
    ]);
    // Staying pressed does not replay; releasing and pressing again does.
    store.setProp('ok', 'pressed', ['true']);
    store.setProp('ok', 'pressed', ['false']);
    store.setProp('ok', 'pressed', ['true']);
    expect(calls.length).toBe(2);
    expect(calls[0].state).toBe('cancelled');
    store.setProp('ok', 'hover', ['true']);
    expect(calls[2].element.id).toBe('ok');
    expect(calls[2].options.duration).toBe(200);
    store.setProp('other', 'pressed', ['true']);
    expect(calls.length).toBe(3);
    unsubscribe();
    store.removeProp('ok', 'pressed');
    store.setProp('ok', 'pressed', ['true']);
    expect(calls.length).toBe(3);
  });

  it('fires an element trigger on that element and plays on its target', () => {
    const { calls, player } = setup(`${ANIMATIONS}
(ok: button (label OK) (on hover (play glow (target other))))`);
    const store = createStore({ text: '(ok: button)\n(other: button)' });
    player.bindTriggers(store);
    store.setProp('other', 'hover', ['true']);
    expect(calls.length).toBe(0);
    store.setProp('ok', 'hover', ['true']);
    expect(calls.map((c) => [c.element.id, c.options.duration])).toEqual([
      ['other', 200],
    ]);
  });

  it('lists the plays of a state with triggersFor', () => {
    const model = loadAnimations(`${ANIMATIONS}
(ok: button (on hover (play glow (target other))))`);
    const store = createStore({ text: '(ok: button (on focus (play glow)))' });
    expect(triggersFor(model, store, 'ok', 'pressed')).toEqual([
      { animation: 'press', target: 'ok' },
    ]);
    expect(triggersFor(model, store, 'ok', 'hover')).toEqual([
      { animation: 'glow', target: 'other' },
    ]);
    expect(triggersFor(model, store, 'ok', 'focus')).toEqual([
      { animation: 'glow', target: 'ok' },
    ]);
    expect(triggersFor(model, store, 'other', 'hover')).toEqual([]);
  });
});
