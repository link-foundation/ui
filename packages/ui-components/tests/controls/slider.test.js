/**
 * slider: the thumb is the `slider` with its value, range and value text;
 * every key commits one store write.
 */

import { describe, it, expect } from 'test-anywhere';
import { attrs, microtasks, mountDoc, press } from '../support/controls.js';

const VOLUME = `  (volume: slider (label 'Volume') (name volume) (value 40) (step 10) (value-text '{value} %'))`;

const ARIA = [
  'role',
  'aria-valuenow',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuetext',
];

describe('slider', () => {
  it('announces its value, range and value text', () => {
    const t = mountDoc(VOLUME);
    expect(t.codes()).toEqual([]);
    const thumb = t.part('volume', 'thumb');
    expect(attrs(thumb, ARIA)).toEqual({
      role: 'slider',
      'aria-valuenow': '40',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuetext': '40 %',
    });
    expect(thumb.tabIndex).toBe(0);
    expect(
      t.document.getElementById(thumb.getAttribute('aria-labelledby'))
        .textContent
    ).toBe('Volume');
    const hidden = t.node('volume').querySelector('input[type="hidden"]');
    expect([hidden.name, hidden.value]).toEqual(['volume', '40']);
  });

  it('steps with the keys, one store write each', async () => {
    const t = mountDoc(VOLUME);
    const thumb = t.part('volume', 'thumb');
    thumb.focus();
    press(thumb, 'ArrowRight');
    await microtasks();
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
    expect(thumb.getAttribute('aria-valuetext')).toBe('50 %');
    press(thumb, 'ArrowDown');
    press(thumb, 'PageUp');
    await microtasks();
    expect(t.prop('volume', 'value')).toEqual(['100']);
    press(thumb, 'Home');
    await microtasks();
    expect(t.prop('volume', 'value')).toEqual(['0']);
    expect(t.transactions.length).toBe(4);
    expect(
      t.node('volume').style.getPropertyValue('--ui-slider-fraction')
    ).toBe('0');
  });

  it('is vertical and disabled with the ARIA flags', async () => {
    const t = mountDoc(
      `  (v: slider (label 'V') (value 5) (orientation vertical) (disabled true))`
    );
    const thumb = t.part('v', 'thumb');
    expect(attrs(thumb, ['aria-orientation', 'aria-disabled'])).toEqual({
      'aria-orientation': 'vertical',
      'aria-disabled': 'true',
    });
    press(thumb, 'ArrowUp');
    await microtasks();
    expect(t.prop('v', 'value')).toEqual(['5']);
  });
});
