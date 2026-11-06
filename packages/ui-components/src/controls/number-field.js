/**
 * `number-field`: a text input with the `spinbutton` role (not
 * `type=number`, whose wheel and locale handling differ between
 * browsers). ArrowUp/ArrowDown step (×10 with Shift), PageUp/PageDown
 * move ten steps; Home/End and Shift+Page retain native text navigation.
 * Typed text commits on `input`, clamped to the range and step, while
 * the exact draft survives store echoes until the native `change`. Text
 * that is not a number makes the field invalid and keeps the last value.
 *
 *   (age: number-field 'Age' (name age) (min 0) (max 130) (value 30))
 */

import {
  changesOf,
  partOf,
  setText,
  flagOf,
  commitValue,
  maybeNumber,
  numberOf,
  textOf,
  receive,
  stopControl,
} from './dom.js';
import { clampStep, nextValue } from './numeric-keys.js';
import { createTextControl, inputOf, updateTextControl } from './text-field.js';

/** The range of a number control's context. */
const rangeOf = (context) => ({
  min: context.min ?? undefined,
  max: context.max ?? undefined,
  step: context.step ?? undefined,
  snapping: context.snapping,
});

/** A number written back to the input (`''` for none). */
export const formatNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

/** Read the typed text: `{value}` (`null` when empty) or `{invalid}`. */
export function readNumber(text, range) {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { value: null, invalid: false };
  }
  const number = Number(trimmed.replace(',', '.'));
  return Number.isFinite(number)
    ? { value: clampStep(number, range), invalid: false }
    : { invalid: true };
}

const actions = (input, getControl) => ({
  'read-draft': (args, meta) => {
    getControl().draft = input.value;
    const read = readNumber(input.value, rangeOf(meta.context));
    meta.assign(read.invalid ? { invalid: true } : read);
  },
  'read-value': (args, meta) => {
    getControl().draft = undefined;
    const read = readNumber(input.value, rangeOf(meta.context));
    meta.assign(read.invalid ? { invalid: true } : read);
  },
  'restore-value': (args, meta) => {
    getControl().draft = undefined;
    meta.assign({ invalid: false });
    input.value = formatNumber(meta.context.value);
  },
  'numeric-key': ([key, shift], meta) => {
    getControl().draft = undefined;
    const value = nextValue(key, {
      ...rangeOf(meta.context),
      value: meta.context.value ?? meta.context.fallback ?? Number.NaN,
      shift: shift === 'shift',
    });
    if (value !== null) {
      meta.assign({ value, invalid: false });
    }
  },
});

/** Show the value (not over invalid text being fixed), then commit it. */
function render(control) {
  const { context } = control.service;
  const input = control.parts.input;
  if (context.invalid !== true && control.draft === undefined) {
    const text = formatNumber(context.value);
    if (input.value !== text) {
      input.value = text;
    }
  }
  commitValue(control);
}

export const NUMBER_FIELD_KIND = Object.freeze({
  tag: 'ui-number-field',
  childrenSlot: null,
  attributes: { disabled: 'boolean', invalid: 'boolean' },
  create: (el, ctx) =>
    createTextControl(el, ctx, {
      tag: 'ui-number-field',
      kind: 'number-field',
      attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off' },
      ignoreInFields: false,
      children: (doc, node) => {
        const parts = {};
        for (const [name, label] of [
          ['decrement', 'Decrease'],
          ['increment', 'Increase'],
        ]) {
          const button = partOf(doc, 'button', name, {
            type: 'button',
            'aria-label': label,
          });
          setText(button, name === 'increment' ? '+' : '−');
          node.appendChild(button);
          parts[name] = button;
        }
        return parts;
      },
      actions,
      render,
    }),
  eventTarget: inputOf,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const { input, control } = updateTextControl(node, el, ctx, has);
    const range = {};
    for (const name of ['min', 'max', 'step', 'fallback']) {
      if (has(name)) {
        range[name] = maybeNumber(el, name);
      }
    }
    if (has('snapping')) {
      range.snapping = textOf(el, 'snapping');
    }
    for (const name of ['increment', 'decrement']) {
      control.parts[name].setAttribute(
        'aria-label',
        textOf(el, `${name}-label`) ||
          (name === 'increment' ? 'Increase' : 'Decrease')
      );
      control.parts[name].toggleAttribute(
        'disabled',
        flagOf(el, 'disabled') || flagOf(el, 'readonly')
      );
    }
    control.assign(range);
    if (has('value')) {
      const value = numberOf(el, 'value', Number.NaN);
      const number = Number.isFinite(value) ? value : null;
      input.setAttribute('value', formatNumber(number));
      if (number !== control.value) {
        control.draft = undefined;
      }
      receive(control, number);
    }
  },
  destroy: stopControl,
});
