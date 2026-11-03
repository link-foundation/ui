/**
 * `sample(animation, tMs)`: pure, deterministic sampling.
 */

import { describe, it, expect } from 'test-anywhere';
import { loadAnimations, sample } from '@link-foundation/ui-animation';
import {
  SAMPLE_TEXT,
  STEP_2_TEXT,
  animationOf,
  resolveToken,
} from './helpers.js';

const press = animationOf(SAMPLE_TEXT, 'press-feedback');
const linearPress = { ...press, easing: { type: 'linear' } };

describe('sample: press-feedback', () => {
  it('is scale 0.96 at 75ms under linear easing', () => {
    expect(sample(linearPress, 75, { resolveToken })).toEqual({ scale: 0.96 });
  });

  it('gives the same values in 1000 calls', () => {
    const first = JSON.stringify(sample(press, 75, { resolveToken }));
    for (let i = 0; i < 1000; i++) {
      expect(JSON.stringify(sample(press, 75, { resolveToken }))).toBe(first);
    }
  });

  it('interpolates between keys and has no effect after the end without fill', () => {
    expect(sample(linearPress, 37.5, { resolveToken })).toEqual({
      scale: 0.98,
    });
    expect(sample(linearPress, 0, { resolveToken })).toEqual({ scale: 1 });
    expect(sample(linearPress, 150, { resolveToken })).toEqual({});
    expect(sample(linearPress, -1, { resolveToken })).toEqual({});
  });

  it('uses the standard easing (cubic-bezier 0.2 0 0 1) of the sample', () => {
    const { scale } = sample(press, 30, { resolveToken });
    // 30ms is 20% of 150ms; standard easing is past 20% by then.
    expect(scale < 0.992).toBe(true);
    expect(scale >= 0.96).toBe(true);
  });
});

describe('sample: the step-2 example', () => {
  const model = loadAnimations(STEP_2_TEXT);
  const panel = model.animations.get('panel-enter');

  it('fills backwards before its delay and interpolates text values', () => {
    const delayed = { ...panel, delay: 100 };
    expect(sample(delayed, 50)).toEqual({ opacity: 0, translate: '0 8px' });
    expect(sample(panel, 300)).toEqual({});
    const mid = sample({ ...panel, easing: { type: 'linear' } }, 150);
    expect(mid).toEqual({ opacity: 0.5, translate: '0 4px' });
  });

  it('runs a spring over its settle time when there is no duration', () => {
    const springy = { ...model.animations.get('bounce'), duration: null };
    expect(sample(springy, 0)).toEqual({ scale: 0.9 });
    const late = sample(springy, 2000);
    expect(late).toEqual({});
  });

  it('runs an effect with its seed', () => {
    const reveal = model.animations.get('title-reveal');
    const a = sample(reveal, 450, { input: 'Hello world' });
    const b = sample(reveal, 450, { input: 'Hello world' });
    expect(a).toEqual(b);
    expect(a.text.length).toBe('Hello world'.length);
    expect(sample(reveal, 899.999, { input: 'Hi' }).text.length).toBe(2);
    expect(
      sample({ ...reveal, fill: 'forwards' }, 900, { input: 'Hi' })
    ).toEqual({
      text: 'Hi',
    });
  });
});

describe('sample: timing', () => {
  const text = `(blink: animation (duration 100ms) (iterations 3) (direction alternate)
  (fill forwards)
  (track opacity (key 0 0) (key 1 1)))`;
  const blink = loadAnimations(text).animations.get('blink');

  it('alternates direction between iterations', () => {
    expect(sample(blink, 25)).toEqual({ opacity: 0.25 });
    expect(sample(blink, 125)).toEqual({ opacity: 0.75 });
    expect(sample(blink, 225)).toEqual({ opacity: 0.25 });
  });

  it('holds the final value with fill forwards', () => {
    expect(sample(blink, 1000)).toEqual({ opacity: 1 });
  });

  it('interpolates colours in OKLCH and writes CSS colours', () => {
    const fade = loadAnimations(
      "(fade: animation (duration 100ms) (track background-color (key 0 '#ff0000') (key 1 '#0000ff')))"
    ).animations.get('fade');
    const start = sample(fade, 0)['background-color'];
    const middle = sample(fade, 50)['background-color'];
    expect(typeof start).toBe('string');
    expect(middle === start).toBe(false);
  });

  it('resolves token values in keys', () => {
    const tokened = loadAnimations(
      '(t: animation (duration 100ms) (track opacity (key 0 (token o.from)) (key 1 1)))'
    ).animations.get('t');
    const resolve = (path) => (path === 'o.from' ? 0.5 : undefined);
    expect(sample(tokened, 0, { resolveToken: resolve })).toEqual({
      opacity: 0.5,
    });
  });
});
