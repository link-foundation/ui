/**
 * Safety rules: persistent fill, WCAG 2.3.1 flashes and reduced motion.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  loadAnimations,
  luminanceChanges,
  validateAnimation,
  validateAnimations,
} from '@link-foundation/ui-animation';
import { SAMPLE_TEXT, STEP_2_TEXT, resolveToken } from './helpers.js';

const validate = (text, id) =>
  validateAnimation(loadAnimations(text).animations.get(id), { resolveToken });
const codes = (diagnostics) =>
  diagnostics.map((d) => `${d.severity}:${d.code}`);

describe('validate: fill', () => {
  it('makes (fill both) on a clip-path track an error', () => {
    const diagnostics = validate(
      `(reveal: animation (duration 300ms) (fill both)
  (track clip-path (key 0 'inset(0 100% 0 0)') (key 1 'inset(0 0 0 0)'))
  (reduced-motion (duration 0ms)))`,
      'reveal'
    );
    expect(codes(diagnostics)).toEqual(['error:persistent-fill']);
    expect(diagnostics[0].at).toEqual({
      element: 'reveal',
      track: 'clip-path',
      fill: 'both',
    });
  });

  it('accepts (fill both) with (persist true) and (fill backwards)', () => {
    const persisted = validate(
      `(reveal: animation (duration 300ms) (fill forwards) (persist true)
  (track translate (key 0 '0 8px') (key 1 '0 0'))
  (reduced-motion (duration 0ms)))`,
      'reveal'
    );
    expect(persisted).toEqual([]);
    const model = loadAnimations(STEP_2_TEXT);
    expect(
      validateAnimation(model.animations.get('panel-enter'), { resolveToken })
    ).toEqual([]);
  });

  it('accepts (fill both) on opacity', () => {
    const diagnostics = validate(
      '(fade: animation (duration 300ms) (fill both) (track opacity (key 0 0) (key 1 1)))',
      'fade'
    );
    expect(diagnostics).toEqual([]);
  });
});

describe('validate: flashes (WCAG 2.3.1)', () => {
  it('makes an 8 Hz opacity (steps 1) flicker a flash error', () => {
    const diagnostics = validate(
      `(flicker: animation (duration 125ms) (iterations infinite)
  (track opacity (key 0 0 (steps 1)) (key 0.5 1 (steps 1)) (key 1 0)))`,
      'flicker'
    );
    expect(codes(diagnostics)).toEqual(['error:flash']);
    expect(diagnostics[0].at.flashes).toBe(8);
    expect(diagnostics[0].at.track).toBe('opacity');
  });

  it('makes an 8 Hz flicker of the animation easing (steps 2) an error', () => {
    const diagnostics = validate(
      `(flicker: animation (duration 125ms) (iterations 20) (easing (steps 2))
  (track opacity (key 0 0) (key 0.5 1) (key 1 0)))`,
      'flicker'
    );
    expect(codes(diagnostics)).toEqual(['error:flash']);
  });

  it('passes a 0.5 Hz breathing glow', () => {
    const diagnostics = validate(
      `(breathe: animation (duration 1s) (iterations infinite) (direction alternate)
  (easing ease-in-out)
  (track opacity (key 0 0.4) (key 1 1)))`,
      'breathe'
    );
    expect(diagnostics).toEqual([]);
  });

  it('passes three flashes a second and fails four', () => {
    const at = (hz) =>
      validate(
        `(f: animation (duration ${1000 / hz}ms) (iterations 10)
  (track opacity (key 0 0 hold) (key 0.5 1 hold) (key 1 0)))`,
        'f'
      );
    expect(at(3)).toEqual([]);
    expect(codes(at(4))).toEqual(['error:flash']);
  });

  it('ignores small or bright changes', () => {
    const dim = validate(
      `(d: animation (duration 125ms) (iterations infinite)
  (track opacity (key 0 0.5 hold) (key 0.5 0.55 hold) (key 1 0.5)))`,
      'd'
    );
    expect(dim).toEqual([]);
    const bright = validate(
      `(b: animation (duration 125ms) (iterations infinite)
  (track background-color (key 0 '#ffffff' hold) (key 0.5 '#f0f0f0' hold) (key 1 '#ffffff')))`,
      'b'
    );
    expect(bright).toEqual([]);
  });

  it('checks colour tracks by relative luminance', () => {
    const diagnostics = validate(
      `(strobe: animation (duration 100ms) (iterations infinite)
  (track background-color (key 0 '#000000' hold) (key 0.5 '#ffffff' hold) (key 1 '#000000')))`,
      'strobe'
    );
    expect(codes(diagnostics)).toEqual(['error:flash']);
  });

  it('counts changes by hysteresis', () => {
    const series = [0, 1, 0, 1, 0].map((l, i) => ({ t: i * 10, l }));
    expect(luminanceChanges(series)).toEqual([10, 20, 30, 40]);
  });
});

describe('validate: reduced motion', () => {
  it('warns about movement without a (reduced-motion ...) block', () => {
    const model = loadAnimations(STEP_2_TEXT);
    const diagnostics = validateAnimations(model, { resolveToken });
    expect(codes(diagnostics)).toEqual(['warning:missing-reduced-motion']);
    expect(diagnostics[0].at.element).toBe('bounce');
  });

  it('has no error for the issue-1 sample', () => {
    const model = loadAnimations(SAMPLE_TEXT);
    const errors = validateAnimations(model, { resolveToken }).filter(
      (d) => d.severity === 'error'
    );
    expect(errors).toEqual([]);
  });
});
