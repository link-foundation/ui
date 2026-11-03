/**
 * Behaviour: the animator asks for a frame only while an animation runs.
 * With nothing moving, no frame callback runs at all (checked over one
 * simulated second with an injected clock and frame scheduler), and with
 * reduced motion an animation jumps to its end at once.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  createAnimator,
  prefersReducedMotion,
} from '../../src/links-view/animator.js';

/** A fake clock and frame scheduler: `advance(ms)` plays 60 Hz frames. */
function fakeFrames() {
  let time = 0;
  let next = 1;
  const pending = new Map();
  let ran = 0;
  const frames = {
    now: () => time,
    raf: (callback) => {
      const handle = next;
      next += 1;
      pending.set(handle, callback);
      return handle;
    },
    caf: (handle) => pending.delete(handle),
    get pending() {
      return pending.size;
    },
    get ran() {
      return ran;
    },
    advance(ms) {
      const end = time + ms;
      while (time + 16 <= end) {
        time += 16;
        const due = [...pending.values()];
        pending.clear();
        for (const callback of due) {
          ran += 1;
          callback(time);
        }
      }
      time = end;
    },
  };
  return frames;
}

const animator = (frames, options = {}) =>
  createAnimator({
    now: frames.now,
    raf: frames.raf,
    caf: frames.caf,
    reducedMotion: () => false,
    ...options,
  });

describe('createAnimator', () => {
  it('runs no frame callback for 1 s when nothing moves', () => {
    const frames = fakeFrames();
    animator(frames);
    frames.advance(1000);
    expect(frames.ran).toBe(0);
    expect(frames.pending).toBe(0);
  });

  it('stops asking for frames when the last animation ends', () => {
    const frames = fakeFrames();
    const a = animator(frames);
    const seen = [];
    a.start('move', ({ elapsed }) => {
      seen.push(elapsed);
      return elapsed < 48;
    });
    frames.advance(1000);
    expect(seen).toEqual([16, 32, 48]);
    expect(frames.ran).toBe(3);
    expect(a.isRunning()).toBe(false);
    expect(frames.pending).toBe(0);
  });

  it('runs several animations on one frame loop', () => {
    const frames = fakeFrames();
    const a = animator(frames);
    let x = 0;
    let y = 0;
    a.start('x', () => {
      x += 1;
      return x < 5;
    });
    a.start('y', () => {
      y += 1;
      return y < 2;
    });
    expect(frames.pending).toBe(1);
    frames.advance(1000);
    expect([x, y]).toEqual([5, 2]);
    expect(frames.ran).toBe(5);
  });

  it('stop ends an animation and cancels the frame when idle', () => {
    const frames = fakeFrames();
    const a = animator(frames);
    a.start('spin', () => true);
    expect(a.isRunning('spin')).toBe(true);
    expect(frames.pending).toBe(1);
    expect(a.stop('spin')).toBe(true);
    expect(a.stop('spin')).toBe(false);
    expect(frames.pending).toBe(0);
    frames.advance(1000);
    expect(frames.ran).toBe(0);
  });

  it('starting the same id again replaces it (one draw per frame)', () => {
    const frames = fakeFrames();
    const a = animator(frames);
    let draws = 0;
    for (let i = 0; i < 10; i += 1) {
      a.start('draw', () => {
        draws += 1;
      });
    }
    frames.advance(1000);
    expect(draws).toBe(1);
  });

  it('with reduced motion calls the step once, at once, and asks no frame', () => {
    const frames = fakeFrames();
    const a = animator(frames, { reducedMotion: () => true });
    const calls = [];
    a.start('move', (frame) => {
      calls.push(frame);
      return true;
    });
    expect(calls).toEqual([{ time: 0, elapsed: 0, reduced: true }]);
    frames.advance(1000);
    expect(frames.ran).toBe(0);
    expect(a.isRunning()).toBe(false);
  });

  it('reports a failing step and keeps the others', () => {
    const frames = fakeFrames();
    const errors = [];
    const a = animator(frames, {
      onError: (error, id) => errors.push([error.message, id]),
    });
    let ok = 0;
    a.start('bad', () => {
      throw new Error('boom');
    });
    a.start('good', () => {
      ok += 1;
      return ok < 3;
    });
    frames.advance(1000);
    expect(errors).toEqual([['boom', 'bad']]);
    expect(ok).toBe(3);
  });

  it('destroy stops everything and ignores later starts', () => {
    const frames = fakeFrames();
    const a = animator(frames);
    a.start('spin', () => true);
    a.destroy();
    a.start('again', () => true);
    expect(frames.pending).toBe(0);
    frames.advance(1000);
    expect(frames.ran).toBe(0);
  });

  it('rejects a step that is not a function', () => {
    expect(() => animator(fakeFrames()).start('x', 1)).toThrow(TypeError);
  });
});

describe('prefersReducedMotion', () => {
  it('reads the media query of a window', () => {
    const win = (matches) => ({
      matchMedia: (query) => ({
        matches: query === '(prefers-reduced-motion: reduce)' && matches,
      }),
    });
    expect(prefersReducedMotion(win(true))).toBe(true);
    expect(prefersReducedMotion(win(false))).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
  });
});
