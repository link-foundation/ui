/**
 * combobox: a text input that filters its options; the arrows move the
 * active option, Enter chooses, Escape closes and then clears.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  attrs,
  microtasks,
  mountDoc,
  press,
  typeInto,
} from '../support/controls.js';

const CITY = `  (city: combobox (label 'City') (name city)
    (berlin: option (label Berlin) (value berlin))
    (paris: option (label Paris) (value paris))
    (prague: option (label Prague) (value prague)))`;

const visible = (t) =>
  ['berlin', 'paris', 'prague'].filter((id) => !t.node(id).hidden);

describe('combobox', () => {
  it('is a labelled text combobox with a list autocomplete', () => {
    const t = mountDoc(CITY);
    expect(t.codes()).toEqual([]);
    const input = t.part('city', 'input');
    expect(
      attrs(input, ['role', 'aria-autocomplete', 'aria-expanded'])
    ).toEqual({
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
    });
    expect(input.labels[0].textContent).toBe('City');
    expect(t.part('city', 'listbox').getAttribute('aria-label')).toBe('City');
  });

  it('filters the options and chooses with ArrowDown and Enter', async () => {
    const t = mountDoc(CITY);
    const input = t.part('city', 'input');
    input.focus();
    typeInto(input, 'pr');
    await microtasks();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(visible(t)).toEqual(['prague']);
    press(input, 'ArrowDown');
    await microtasks();
    expect(input.getAttribute('aria-activedescendant')).toBe(
      t.node('prague').id
    );
    press(input, 'Enter');
    await microtasks();
    expect(input.value).toBe('Prague');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(t.prop('city', 'value')).toEqual(['prague']);
    expect(t.transactions.length).toBe(1);
    const hidden = t.node('city').querySelector('input[type="hidden"]');
    expect([hidden.name, hidden.value, hidden.disabled]).toEqual([
      'city',
      'prague',
      false,
    ]);
  });

  it('closes on Escape, then clears the text', async () => {
    const t = mountDoc(CITY);
    const input = t.part('city', 'input');
    input.focus();
    typeInto(input, 'b');
    await microtasks();
    press(input, 'Escape');
    await microtasks();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('b');
    press(input, 'Escape');
    await microtasks();
    expect(input.value).toBe('');
  });
});
