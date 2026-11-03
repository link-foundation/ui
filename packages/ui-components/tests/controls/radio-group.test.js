/**
 * radio-group: one tab stop (roving tabindex); the arrows move focus and
 * check, skipping disabled radios; the group's value goes to the store and
 * the form.
 */

import { describe, it, expect } from 'test-anywhere';
import { attrs, microtasks, mountDoc, press } from '../support/controls.js';

const SIZE = `  (size: radio-group (label 'Size') (name size) (value m)
    (s: radio (label 'Small') (value s))
    (m: radio (label 'Medium') (value m))
    (l: radio (label 'Large') (value l) (disabled true)))`;

const radios = (t) => ['s', 'm', 'l'].map((id) => t.part(id, 'input'));

describe('radio-group', () => {
  it('is a labelled radiogroup with one tab stop on the checked radio', async () => {
    const t = mountDoc(SIZE);
    await microtasks();
    expect(t.codes()).toEqual([]);
    const root = t.part('size', 'root');
    expect(attrs(root, ['role', 'aria-orientation'])).toEqual({
      role: 'radiogroup',
      'aria-orientation': 'horizontal',
    });
    expect(
      t.document.getElementById(root.getAttribute('aria-labelledby'))
        .textContent
    ).toBe('Size');
    expect(radios(t).map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(radios(t).map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    const hidden = t.node('size').querySelector('input[type="hidden"]');
    expect([hidden.name, hidden.value]).toEqual(['size', 'm']);
  });

  it('moves and checks with the arrows, skipping a disabled radio', async () => {
    const t = mountDoc(SIZE);
    await microtasks();
    const [s, m] = radios(t);
    m.focus();
    press(m, 'ArrowRight');
    await microtasks();
    expect(t.document.activeElement).toBe(s);
    expect(s.getAttribute('aria-checked')).toBe('true');
    expect(radios(t).map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    expect(t.prop('size', 'value')).toEqual(['s']);
    expect(t.transactions.length).toBe(1);
    press(s, 'ArrowLeft');
    await microtasks();
    expect(t.document.activeElement).toBe(m);
    expect(t.prop('size', 'value')).toEqual(['m']);
  });

  it('dispatches (on change ...) with the new value', async () => {
    const t =
      mountDoc(`  (size: radio-group (label 'Size') (on change (emit resized))
    (s: radio (label 'Small') (value s))
    (m: radio (label 'Medium') (value m)))`);
    await microtasks();
    t.part('m', 'input').click();
    expect(t.changes).toEqual([
      { source: 'size', property: 'value', value: 'm' },
    ]);
    expect(t.emitted.map((e) => e.event)).toEqual(['resized']);
  });

  it('lays the radios out vertically', () => {
    const t = mountDoc(`  (v: radio-group (label 'V') (orientation vertical)
    (a: radio (label 'A')))`);
    expect(t.part('v', 'root').getAttribute('aria-orientation')).toBe(
      'vertical'
    );
  });
});
