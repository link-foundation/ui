/** radio: one choice of a radio-group; a disabled radio cannot be chosen. */

import { describe, it, expect } from 'test-anywhere';
import { microtasks, mountDoc } from '../support/controls.js';

describe('radio', () => {
  it('is a radio button with its label and value', async () => {
    const t = mountDoc(`  (g: radio-group (label 'G')
    (a: radio (label 'Apple') (value apple)))`);
    await microtasks();
    expect(t.codes()).toEqual([]);
    const input = t.part('a', 'input');
    expect(input.tagName).toBe('BUTTON');
    expect(input.getAttribute('role')).toBe('radio');
    expect(input.getAttribute('aria-checked')).toBe('false');
    expect(t.part('a', 'label').textContent).toBe('Apple');
    expect(t.node('a').getAttribute('data-value')).toBe('apple');
  });

  it('cannot be checked when disabled', async () => {
    const t = mountDoc(`  (g: radio-group (label 'G')
    (a: radio (label 'Apple') (disabled true)))`);
    await microtasks();
    const input = t.part('a', 'input');
    expect(
      input.disabled || input.getAttribute('aria-disabled') === 'true'
    ).toBe(true);
    input.click();
    await microtasks();
    expect(input.getAttribute('aria-checked')).toBe('false');
    expect(t.prop('g', 'value')).toBe(undefined);
  });
});
