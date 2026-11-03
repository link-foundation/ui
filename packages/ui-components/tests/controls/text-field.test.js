/**
 * text-field: a native input committed on `change` as one store write,
 * Escape restores the committed value, letters never reach key bindings.
 */

import { describe, it, expect } from 'test-anywhere';
import { bindKeys } from '../../src/a11y/index.js';
import {
  attrs,
  commit,
  mountDoc,
  press,
  typeInto,
} from '../support/controls.js';

const FIELD = `  (name: text-field (label 'Name') (name name) (value Ada) (on change (emit renamed)))`;

describe('text-field', () => {
  it('is a labelled native input in a form', () => {
    const t = mountDoc(FIELD);
    expect(t.codes()).toEqual([]);
    const input = t.part('name', 'input');
    expect(input.tagName).toBe('INPUT');
    expect(attrs(input, ['type', 'name', 'aria-invalid'])).toEqual({
      type: 'text',
      name: 'name',
      'aria-invalid': 'false',
    });
    expect(input.value).toBe('Ada');
    expect(input.labels[0].textContent).toBe('Name');
  });

  it('commits a typed value once, then runs (on change ...)', () => {
    const t = mountDoc(FIELD);
    const input = t.part('name', 'input');
    input.focus();
    typeInto(input, 'Grace');
    expect(t.transactions.length).toBe(0);
    commit(input);
    expect(t.prop('name', 'value')).toEqual(['Grace']);
    expect(t.transactions.length).toBe(1);
    expect(t.changes).toEqual([
      { source: 'name', property: 'value', value: 'Grace' },
    ]);
    expect(t.actions).toEqual(['name:change']);
    expect(t.emitted.map((e) => e.event)).toEqual(['renamed']);
  });

  it('restores the committed value on Escape', () => {
    const t = mountDoc(FIELD);
    const input = t.part('name', 'input');
    input.focus();
    typeInto(input, 'Ad');
    press(input, 'Escape');
    expect(input.value).toBe('Ada');
    commit(input);
    expect(t.changes).toEqual([]);
  });

  it('shows the required, invalid and disabled states', () => {
    const t =
      mountDoc(`  (a: text-field (label 'A') (required true) (invalid true))
  (b: text-field (label 'B') (disabled true) (placeholder 'Type here'))`);
    const a = t.part('a', 'input');
    expect(a.required).toBe(true);
    expect(a.getAttribute('aria-invalid')).toBe('true');
    const b = t.part('b', 'input');
    expect(b.disabled).toBe(true);
    expect(b.placeholder).toBe('Type here');
  });

  it('never fires a letter shortcut while typing', () => {
    const t = mountDoc(FIELD);
    let fired = 0;
    bindKeys(t.document, { s: () => (fired += 1) });
    press(t.document.body, 's');
    expect(fired).toBe(1);
    press(t.part('name', 'input'), 's');
    expect(fired).toBe(1);
  });
});
