/** text-area: a native textarea committed like text-field. */

import { describe, it, expect } from 'test-anywhere';
import { commit, mountDoc, typeInto } from '../support/controls.js';

describe('text-area', () => {
  it('is a labelled native textarea with its rows', () => {
    const t = mountDoc(
      `  (notes: text-area (label 'Notes') (name notes) (rows 4))`
    );
    expect(t.codes()).toEqual([]);
    const input = t.part('notes', 'input');
    expect(input.tagName).toBe('TEXTAREA');
    expect(input.name).toBe('notes');
    expect(input.rows).toBe(4);
    expect(input.labels[0].textContent).toBe('Notes');
  });

  it('commits the text on change as one store write', () => {
    const t = mountDoc(`  (notes: text-area (label 'Notes'))`);
    const input = t.part('notes', 'input');
    input.focus();
    typeInto(input, 'Line 1\nLine 2');
    commit(input);
    expect(t.prop('notes', 'value')).toEqual(['Line 1\nLine 2']);
    expect(t.transactions.length).toBe(1);
  });

  it('is disabled and invalid with the native and ARIA flags', () => {
    const t = mountDoc(
      `  (notes: text-area (label 'Notes') (disabled true) (invalid true))`
    );
    const input = t.part('notes', 'input');
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
