/**
 * `toWaapi`: the Web Animations API arguments of an animation.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  keyframeProperty,
  loadAnimations,
  toWaapi,
} from '@link-foundation/ui-animation';
import {
  SAMPLE_TEXT,
  STEP_2_TEXT,
  animationOf,
  resolveToken,
} from './helpers.js';

describe('toWaapi', () => {
  it('compiles press-feedback to the step-6 object', () => {
    const press = animationOf(SAMPLE_TEXT, 'press-feedback');
    expect(toWaapi(press, { resolveToken })).toEqual({
      keyframes: [
        { offset: 0, scale: '1' },
        { offset: 0.5, scale: '0.96' },
        { offset: 1, scale: '1' },
      ],
      options: {
        duration: 150,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'none',
        composite: 'replace',
      },
    });
  });

  it('merges tracks by offset and writes non-default timing', () => {
    const panel = animationOf(STEP_2_TEXT, 'panel-enter');
    expect(toWaapi(panel)).toEqual({
      keyframes: [
        { offset: 0, opacity: '0', translate: '0 8px' },
        { offset: 1, opacity: '1', translate: '0 0' },
      ],
      options: {
        duration: 300,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'backwards',
        composite: 'replace',
      },
    });
    const loop = loadAnimations(
      '(l: animation (duration 1s) (delay 200ms) (iterations infinite) (direction alternate) (track background-color (key 0 red) (key 1 blue)))'
    ).animations.get('l');
    const { keyframes, options } = toWaapi(loop);
    expect(Object.keys(keyframes[0])).toEqual(['offset', 'backgroundColor']);
    expect(options.delay).toBe(200);
    expect(options.iterations).toBe(Infinity);
    expect(options.direction).toBe('alternate');
  });

  it('writes a spring easing as linear() and key easings on keyframes', () => {
    const bounce = animationOf(STEP_2_TEXT, 'bounce');
    expect(toWaapi(bounce).options.easing.startsWith('linear(0, ')).toBe(true);
    const held = loadAnimations(
      '(h: animation (duration 100ms) (track opacity (key 0 0 hold) (key 1 1)))'
    ).animations.get('h');
    expect(toWaapi(held).keyframes[0]).toEqual({
      offset: 0,
      easing: 'steps(1, jump-end)',
      opacity: '0',
    });
  });

  it('leaves effects and non-CSS tracks to the frame loop', () => {
    const reveal = animationOf(STEP_2_TEXT, 'title-reveal');
    expect(toWaapi(reveal).keyframes).toEqual([]);
    const label = loadAnimations(
      "(t: animation (duration 100ms) (track text (key 0 'a') (key 1 'b')) (track opacity (key 0 0) (key 1 1)))"
    ).animations.get('t');
    expect(toWaapi(label).keyframes).toEqual([
      { offset: 0, opacity: '0' },
      { offset: 1, opacity: '1' },
    ]);
  });

  it('bakes an envelope into sampled keyframes', () => {
    const glow = loadAnimations(
      '(g: animation (duration 1s) (envelope bell) (composite add) (track opacity (key 0 0.4) (key 1 0.4)))'
    ).animations.get('g');
    const { keyframes, options } = toWaapi(glow);
    expect(keyframes.length).toBe(41);
    expect(options.easing).toBe('linear');
    expect(options.composite).toBe('add');
    expect(keyframes[20].opacity).toBe('0.4');
    expect(keyframes[0].opacity).toBe('0');
  });

  it('names keyframe properties as WAAPI does', () => {
    expect(keyframeProperty('clip-path')).toBe('clipPath');
    expect(keyframeProperty('offset')).toBe('cssOffset');
    expect(keyframeProperty('--glow')).toBe('--glow');
  });
});
