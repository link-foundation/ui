/**
 * color-field: a hex text input and the native picker; both commit the
 * normalised `#rrggbb`, text that is not a colour is invalid.
 */

import { describe, it, expect } from 'test-anywhere';
import { commit, mountDoc, press, typeInto } from '../support/controls.js';

const COLOUR = `  (accent: color-field (label 'Accent') (name accent) (value '#6750a4'))`;

describe('color-field', () => {
  it('is a labelled hex input with a picker out of the tab order', () => {
    const t = mountDoc(COLOUR);
    expect(t.codes()).toEqual([]);
    const input = t.part('accent', 'input');
    expect(input.value).toBe('#6750a4');
    expect(input.name).toBe('accent');
    expect(input.labels[0].textContent).toBe('Accent');
    const picker = t.part('accent', 'indicator');
    expect(picker.type).toBe('color');
    expect(picker.tabIndex).toBe(-1);
    expect(picker.getAttribute('aria-hidden')).toBe('true');
    expect(picker.value).toBe('#6750a4');
  });

  it('normalises typed hex text', () => {
    const t = mountDoc(COLOUR);
    const input = t.part('accent', 'input');
    typeInto(input, '#ABC');
    commit(input);
    expect(t.prop('accent', 'value')).toEqual(['#aabbcc']);
    expect(input.value).toBe('#aabbcc');
    expect(t.part('accent', 'indicator').value).toBe('#aabbcc');
    expect(t.transactions.length).toBe(1);
  });

  it('commits the picked colour', () => {
    const t = mountDoc(COLOUR);
    const picker = t.part('accent', 'indicator');
    picker.value = '#112233';
    commit(picker);
    expect(t.prop('accent', 'value')).toEqual(['#112233']);
  });

  it('marks text that is not a colour invalid; Escape restores', () => {
    const t = mountDoc(COLOUR);
    const input = t.part('accent', 'input');
    typeInto(input, 'purple');
    commit(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(t.prop('accent', 'value')).toEqual(['#6750a4']);
    press(input, 'Escape');
    expect(input.value).toBe('#6750a4');
  });
});
