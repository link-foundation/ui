/**
 * `loadAnimations`: the animation model of Links Notation text.
 */

import { describe, it, expect } from 'test-anywhere';
import { loadAnimations } from '@link-foundation/ui-animation';
import { SAMPLE_TEXT, STEP_2_TEXT, errorsOf } from './helpers.js';

const codes = (model) => model.diagnostics.map((d) => d.code);

describe('loadAnimations: the samples', () => {
  it('loads samples/animation.lino with no error diagnostics', () => {
    const model = loadAnimations(SAMPLE_TEXT);
    expect(errorsOf(model.diagnostics)).toEqual([]);
    const press = model.animations.get('press-feedback');
    expect(press.target).toBe('ok');
    expect(press.duration).toEqual({
      type: 'token',
      path: 'motion.duration.short',
    });
    expect(press.easing).toEqual({ type: 'named', name: 'standard' });
    expect(press.tracks).toEqual([
      {
        property: 'scale',
        keys: [
          { offset: 0, value: { type: 'number', value: 1 }, easing: null },
          { offset: 0.5, value: { type: 'number', value: 0.96 }, easing: null },
          { offset: 1, value: { type: 'number', value: 1 }, easing: null },
        ],
      },
    ]);
  });

  it('loads the step-2 example with no error diagnostics', () => {
    const model = loadAnimations(STEP_2_TEXT);
    expect(errorsOf(model.diagnostics)).toEqual([]);
    expect([...model.animations.keys()]).toEqual([
      'panel-enter',
      'bounce',
      'title-reveal',
    ]);
    expect([...model.timelines.keys()]).toEqual(['intro']);
  });

  it('reads every field of the step-2 animations', () => {
    const { animations, timelines } = loadAnimations(STEP_2_TEXT);
    const panel = animations.get('panel-enter');
    expect(panel.duration).toBe(300);
    expect(panel.fill).toBe('backwards');
    expect(panel.easing).toEqual({
      type: 'cubic-bezier',
      points: [0.2, 0, 0, 1],
    });
    expect(panel.tracks.map((t) => t.property)).toEqual([
      'opacity',
      'translate',
    ]);
    expect(panel.tracks[1].keys[0].value).toEqual({
      type: 'text',
      parts: ['', { value: 0, unit: '' }, ' ', { value: 8, unit: 'px' }, ''],
    });
    expect(panel.reducedMotion).toEqual({ duration: 0 });
    expect(animations.get('bounce').easing).toEqual({
      type: 'spring',
      stiffness: 300,
      damping: 20,
      mass: 1,
    });
    expect(animations.get('title-reveal').effect).toEqual({
      name: 'decipher',
      params: { seed: 42 },
    });
    expect(timelines.get('intro').items).toEqual([
      {
        type: 'at',
        time: 0,
        items: [
          { type: 'play', id: 'panel-enter', target: 'sidebar', targets: null },
        ],
      },
      {
        type: 'at',
        time: 120,
        items: [
          {
            type: 'stagger',
            step: 50,
            items: [
              { type: 'play', id: 'bounce', target: null, targets: null },
            ],
            targets: ['item-1', 'item-2', 'item-3'],
          },
        ],
      },
    ]);
  });
});

describe('loadAnimations: key offsets', () => {
  it('reports an offset outside 0..1', () => {
    const model = loadAnimations(
      '(a: animation (duration 100ms) (track opacity (key 0 0) (key 1.5 1)))'
    );
    expect(codes(model)).toContain('key-offset-range');
    expect(errorsOf(model.diagnostics).length).toBe(1);
  });

  it('reports offsets out of order', () => {
    const model = loadAnimations(
      '(a: animation (duration 100ms) (track opacity (key 0.6 0) (key 0.4 1)))'
    );
    expect(codes(model)).toContain('key-offset-order');
  });

  it('reports an offset that is not a number', () => {
    const model = loadAnimations(
      '(a: animation (duration 100ms) (track opacity (key half 0)))'
    );
    expect(errorsOf(model.diagnostics).length > 0).toBe(true);
  });

  it('accepts a key easing of the segment that starts there', () => {
    const { animations, diagnostics } = loadAnimations(
      '(a: animation (duration 100ms) (track opacity (key 0 0 hold) (key 1 1)))'
    );
    expect(diagnostics).toEqual([]);
    expect(animations.get('a').tracks[0].keys[0].easing).toEqual({
      type: 'named',
      name: 'hold',
    });
    expect(animations.get('a').tracks[0].keys[1].easing).toBe(null);
  });
});

describe('loadAnimations: references and triggers', () => {
  it('reports a timeline that plays an unknown animation', () => {
    const model = loadAnimations('(t: timeline (play nothing))');
    expect(codes(model)).toEqual(['unknown-animation']);
  });

  it('reports a timeline cycle', () => {
    const model = loadAnimations(
      '(a: timeline (play b))\n(b: timeline (play a))'
    );
    expect(codes(model)).toContain('timeline-cycle');
  });

  it('warns about an unknown effect, easing and sublink', () => {
    const model = loadAnimations(
      '(a: animation (duration 1s) (easing wobbly) (effect glitter) (speed 2))'
    );
    expect(codes(model).sort()).toEqual([
      'unknown-easing',
      'unknown-effect',
      'unknown-sublink',
    ]);
    expect(errorsOf(model.diagnostics)).toEqual([]);
    expect(model.animations.get('a').duration).toBe(1000);
  });

  it('reads (on STATE) triggers of animations and other elements', () => {
    const model = loadAnimations(`(press: animation (target ok) (duration 100ms)
  (track scale (key 0 1) (key 1 0.9))
  (on pressed))
(ok: button (label OK) (on hover (play press (target other))))`);
    expect(model.diagnostics).toEqual([]);
    expect(model.triggers).toEqual([
      { state: 'pressed', element: 'ok', animation: 'press', target: 'ok' },
      { state: 'hover', element: 'ok', animation: 'press', target: 'other' },
    ]);
  });

  it('reads iterations, direction, delay and tokens', () => {
    const model = loadAnimations(
      '(a: animation (duration 2s) (delay (token motion.delay)) (iterations infinite) (direction alternate) (track opacity (key 0 0) (key 1 1)))'
    );
    const a = model.animations.get('a');
    expect(a.iterations).toBe(Infinity);
    expect(a.direction).toBe('alternate');
    expect(a.delay).toEqual({ type: 'token', path: 'motion.delay' });
  });
});
