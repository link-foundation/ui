/**
 * `sampleLayers`: several animations on one element.
 */

import { describe, it, expect } from 'test-anywhere';
import { loadAnimations, sampleLayers } from '@link-foundation/ui-animation';

const { animations } = loadAnimations(`(base: animation (duration 100ms)
  (track scale (key 0 0.9) (key 1 0.9))
  (track opacity (key 0 0.5) (key 1 0.5)))
(boost: animation (duration 100ms) (composite add)
  (track scale (key 0 1.1) (key 1 1.1))
  (track translate (key 0 '0 4px') (key 1 '0 4px')))
(nudge: animation (duration 100ms) (composite add)
  (track translate (key 0 '2px 2px') (key 1 '2px 2px')))
(over: animation (duration 100ms)
  (track opacity (key 0 1) (key 1 1)))
(glow: animation (duration 1000ms) (envelope bell) (composite add)
  (track opacity (key 0 0.4) (key 1 0.4)))`);
const get = (id) => animations.get(id);

describe('sampleLayers', () => {
  it('multiplies an additive scale and replaces otherwise', () => {
    const values = sampleLayers([get('base'), get('boost'), get('over')], 50);
    expect(Math.abs(values.scale - 0.99) < 1e-9).toBe(true);
    expect(values.opacity).toBe(1);
    expect(values.translate).toBe('0 4px');
  });

  it('adds text quantities component by component', () => {
    const values = sampleLayers([get('boost'), get('nudge')], 50);
    expect(values.translate).toBe('2px 6px');
  });

  it('starts each layer at its own time', () => {
    const values = sampleLayers(
      [get('base'), { animation: get('over'), start: 80 }],
      50
    );
    expect(values.opacity).toBe(0.5);
    expect(
      sampleLayers([get('base'), { animation: get('over'), start: 40 }], 50)
        .opacity
    ).toBe(1);
  });

  it('weights an envelope layer: a bell rises and falls', () => {
    const at = (t) => sampleLayers([get('base'), get('glow')], t).opacity;
    const steady = sampleLayers([get('base')], 50).opacity;
    expect(steady).toBe(0.5);
    const peak = sampleLayers(
      [{ animation: get('glow'), start: 0 }],
      500
    ).opacity;
    expect(Math.abs(peak - 0.4) < 1e-9).toBe(true);
    expect(at(50) > 0.5).toBe(true);
    expect(sampleLayers([get('glow')], 0).opacity).toBe(0);
  });
});
