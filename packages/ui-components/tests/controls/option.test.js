/** option: a choice of a select or a combobox; its value defaults to its ID. */

import { describe, it, expect } from 'test-anywhere';
import { microtasks, mountDoc, press } from '../support/controls.js';

describe('option', () => {
  it('is role=option with its label and value', () => {
    const t = mountDoc(`  (s: select (label 'S')
    (m: option (label 'Medium') (value medium))
    (l: option 'Large'))`);
    expect(t.codes()).toEqual([]);
    const m = t.node('m');
    expect(m.getAttribute('role')).toBe('option');
    expect(m.getAttribute('aria-selected')).toBe('false');
    expect(m.getAttribute('data-value')).toBe('medium');
    expect(t.part('m', 'label').textContent).toBe('Medium');
    expect(t.node('l').getAttribute('data-value')).toBe('l');
  });

  it('is skipped by the keys when disabled', async () => {
    const t = mountDoc(`  (s: select (label 'S')
    (a: option (label 'A'))
    (b: option (label 'B') (disabled true))
    (c: option (label 'C')))`);
    expect(t.node('b').getAttribute('aria-disabled')).toBe('true');
    const button = t.part('s', 'input');
    button.focus();
    press(button, 'ArrowDown');
    press(button, 'ArrowDown');
    await microtasks();
    expect(button.getAttribute('aria-activedescendant')).toBe(t.node('c').id);
  });
});
