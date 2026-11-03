/**
 * switch: `role=switch` with `aria-checked`; Space, Enter and a click
 * toggle it; a form gets `value` while it is on.
 */

import { describe, it, expect } from 'test-anywhere';
import { microtasks, mountDoc, press } from '../support/controls.js';

const WIFI = `  (wifi: switch (label 'Wi-Fi') (name wifi) (checked true) (on change (emit toggled)))`;

describe('switch', () => {
  it('is a named switch button', () => {
    const t = mountDoc(WIFI);
    expect(t.codes()).toEqual([]);
    const input = t.part('wifi', 'input');
    expect(input.tagName).toBe('BUTTON');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.getAttribute('aria-checked')).toBe('true');
    expect(t.part('wifi', 'label').textContent).toBe('Wi-Fi');
  });

  it('toggles aria-checked on Space and on Enter', async () => {
    const t = mountDoc(WIFI);
    const input = t.part('wifi', 'input');
    press(input, ' ');
    await microtasks();
    expect(input.getAttribute('aria-checked')).toBe('false');
    expect(t.prop('wifi', 'checked')).toEqual(['false']);
    press(input, 'Enter');
    await microtasks();
    expect(input.getAttribute('aria-checked')).toBe('true');
    expect(t.prop('wifi', 'checked')).toEqual(['true']);
    expect(t.transactions.length).toBe(2);
    expect(t.emitted.map((e) => e.event)).toEqual(['toggled', 'toggled']);
  });

  it('toggles on a click', async () => {
    const t = mountDoc(WIFI);
    t.part('wifi', 'input').click();
    await microtasks();
    expect(t.part('wifi', 'input').getAttribute('aria-checked')).toBe('false');
  });

  it('submits its value only while on', async () => {
    const t = mountDoc(WIFI);
    const hidden = t.node('wifi').querySelector('input[type="hidden"]');
    expect([hidden.name, hidden.value, hidden.disabled]).toEqual([
      'wifi',
      'on',
      false,
    ]);
    press(t.part('wifi', 'input'), ' ');
    await microtasks();
    expect(hidden.disabled).toBe(true);
  });

  it('never toggles when disabled', async () => {
    const t = mountDoc(`  (wifi: switch (label 'Wi-Fi') (disabled true))`);
    const input = t.part('wifi', 'input');
    expect(input.disabled).toBe(true);
    press(input, ' ');
    await microtasks();
    expect(input.getAttribute('aria-checked')).toBe('false');
  });
});
