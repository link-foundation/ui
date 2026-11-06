/**
 * number-field: a `spinbutton` text input; the keys step within the range
 * (one store write per key), typed text is clamped, non-numbers are
 * invalid.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  attrs,
  commit,
  mountDoc,
  press,
  typeInto,
} from '../support/controls.js';

const QTY = `  (qty: number-field (label 'Quantity') (name qty) (value 3) (min 0) (max 10))`;

describe('number-field', () => {
  it('is a spinbutton with its range', () => {
    const t = mountDoc(QTY);
    expect(t.codes()).toEqual([]);
    const input = t.part('qty', 'input');
    expect(
      attrs(input, [
        'role',
        'inputmode',
        'aria-valuenow',
        'aria-valuemin',
        'aria-valuemax',
      ])
    ).toEqual({
      role: 'spinbutton',
      inputmode: 'decimal',
      'aria-valuenow': '3',
      'aria-valuemin': '0',
      'aria-valuemax': '10',
    });
    expect(input.name).toBe('qty');
  });

  it('steps with the keys, one store write each', () => {
    const t = mountDoc(QTY);
    const input = t.part('qty', 'input');
    press(input, 'ArrowUp');
    expect(t.prop('qty', 'value')).toEqual(['4']);
    expect(input.getAttribute('aria-valuenow')).toBe('4');
    press(input, 'ArrowDown');
    press(input, 'ArrowDown');
    expect(input.value).toBe('2');
    expect(press(input, 'End').defaultPrevented).toBe(false);
    expect(press(input, 'Home').defaultPrevented).toBe(false);
    expect(t.prop('qty', 'value')).toEqual(['2']);
    expect(t.transactions.length).toBe(3);
  });

  it('clamps typed numbers and marks text invalid', () => {
    const t = mountDoc(QTY);
    const input = t.part('qty', 'input');
    typeInto(input, '42');
    commit(input);
    expect(t.prop('qty', 'value')).toEqual(['10']);
    expect(input.value).toBe('10');
    typeInto(input, 'many');
    commit(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(t.prop('qty', 'value')).toEqual(['10']);
  });

  it('ignores the keys when disabled', () => {
    const t = mountDoc(
      `  (qty: number-field (label 'Q') (value 3) (disabled true))`
    );
    const input = t.part('qty', 'input');
    expect(input.disabled).toBe(true);
    press(input, 'ArrowUp');
    expect(t.prop('qty', 'value')).toEqual(['3']);
  });
});
