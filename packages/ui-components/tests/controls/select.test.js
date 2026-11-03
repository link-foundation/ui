/**
 * select: a select-only combobox; the focus stays on the button, the
 * active option is its `aria-activedescendant`, typing jumps, Enter
 * chooses, Escape closes.
 */

import { describe, it, expect } from 'test-anywhere';
import { attrs, microtasks, mountDoc, press } from '../support/controls.js';

const FRUIT = `  (fruit: select (label 'Fruit') (name fruit) (placeholder 'Choose') (on change (emit picked))
    (apple: option (label 'Apple') (value apple))
    (pear: option (label 'Pear') (value pear))
    (plum: option (label 'Plum') (value plum)))`;

const optionId = (t, id) => t.node(id).id;

describe('select', () => {
  it('is a closed select-only combobox showing the placeholder', () => {
    const t = mountDoc(FRUIT);
    expect(t.codes()).toEqual([]);
    const button = t.part('fruit', 'input');
    expect(attrs(button, ['role', 'aria-haspopup', 'aria-expanded'])).toEqual({
      role: 'combobox',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
    });
    const listbox = t.part('fruit', 'listbox');
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.hidden).toBe(true);
    expect(button.getAttribute('aria-controls')).toBe(listbox.id);
    expect(t.part('fruit', 'value').textContent).toBe('Choose');
  });

  it('opens on ArrowDown, jumps by typeahead and chooses on Enter', async () => {
    const t = mountDoc(FRUIT);
    const button = t.part('fruit', 'input');
    button.focus();
    press(button, 'ArrowDown');
    await microtasks();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(t.part('fruit', 'listbox').hidden).toBe(false);
    expect(button.getAttribute('aria-activedescendant')).toBe(
      optionId(t, 'apple')
    );
    press(button, 'p');
    await microtasks();
    expect(button.getAttribute('aria-activedescendant')).toBe(
      optionId(t, 'pear')
    );
    press(button, 'p');
    await microtasks();
    expect(button.getAttribute('aria-activedescendant')).toBe(
      optionId(t, 'plum')
    );
    press(button, 'Enter');
    await microtasks();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(t.document.activeElement).toBe(button);
    expect(t.prop('fruit', 'value')).toEqual(['plum']);
    expect(t.node('plum').getAttribute('aria-selected')).toBe('true');
    expect(t.part('fruit', 'value').textContent).toBe('Plum');
    expect(t.transactions.length).toBe(1);
    expect(t.emitted.map((e) => e.event)).toEqual(['picked']);
  });

  it('closes on Escape without choosing', async () => {
    const t = mountDoc(FRUIT);
    const button = t.part('fruit', 'input');
    button.focus();
    press(button, 'ArrowDown');
    press(button, 'ArrowDown');
    press(button, 'Escape');
    await microtasks();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-activedescendant')).toBe(false);
    expect(t.prop('fruit', 'value')).toBe(undefined);
  });

  it('submits the chosen value', async () => {
    const t = mountDoc(FRUIT.replace("(placeholder 'Choose')", '(value pear)'));
    await microtasks();
    const hidden = t.node('fruit').querySelector('input[type="hidden"]');
    expect([hidden.name, hidden.value]).toEqual(['fruit', 'pear']);
    expect(t.part('fruit', 'value').textContent).toBe('Pear');
  });
});
