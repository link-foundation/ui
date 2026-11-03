/**
 * checkbox: a native checkbox; `mixed` is the indeterminate state and the
 * next toggle checks it; a form submits `value` while it is checked.
 */

import { describe, it, expect } from 'test-anywhere';
import { microtasks, mountDoc, press } from '../support/controls.js';

describe('checkbox', () => {
  it('is a labelled native checkbox', () => {
    const t = mountDoc(`  (terms: checkbox (label 'I accept') (name terms))`);
    expect(t.codes()).toEqual([]);
    const input = t.part('terms', 'input');
    expect(input.type).toBe('checkbox');
    expect(input.name).toBe('terms');
    expect(input.value).toBe('on');
    expect(input.checked).toBe(false);
    expect(input.labels[0].textContent).toBe('I accept');
  });

  it('shows mixed as indeterminate; a toggle checks it', async () => {
    const t = mountDoc(`  (all: checkbox (label 'All') (checked mixed))`);
    const input = t.part('all', 'input');
    expect(input.indeterminate).toBe(true);
    expect(input.getAttribute('data-state')).toBe('mixed');
    input.click();
    await microtasks();
    expect(input.indeterminate).toBe(false);
    expect(input.checked).toBe(true);
    expect(t.prop('all', 'checked')).toEqual(['true']);
    input.click();
    await microtasks();
    expect(input.checked).toBe(false);
    expect(t.prop('all', 'checked')).toEqual(['false']);
    expect(t.transactions.length).toBe(2);
  });

  it('runs (on change ...) after the store write', () => {
    const t = mountDoc(
      `  (terms: checkbox (label 'I accept') (on change (emit accepted)))`
    );
    t.part('terms', 'input').click();
    expect(t.changes).toEqual([
      { source: 'terms', property: 'checked', value: true },
    ]);
    expect(t.actions).toEqual(['terms:change']);
    expect(t.emitted.map((e) => e.event)).toEqual(['accepted']);
  });

  it('is natively disabled and invalid with aria-invalid', () => {
    const t = mountDoc(`  (a: checkbox (label 'A') (disabled true))
  (b: checkbox (label 'B') (invalid true) (required true))`);
    expect(t.part('a', 'input').disabled).toBe(true);
    const b = t.part('b', 'input');
    expect(b.getAttribute('aria-invalid')).toBe('true');
    expect(b.required).toBe(true);
    press(b, ' ');
    expect(t.part('a', 'input').checked).toBe(false);
  });
});
