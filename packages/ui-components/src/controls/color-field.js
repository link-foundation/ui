/**
 * `color-field`: a hex text input and the native colour picker
 * (`<input type=color>`, the `indicator` part) side by side. Both commit
 * the normalised `#rrggbb`; text that is not a hex colour makes the field
 * invalid and keeps the last colour. Escape restores it.
 *
 *   (accent: color-field 'Accent' (name accent) (value '#6750a4'))
 */

import {
  changesOf,
  commitValue,
  partOf,
  receive,
  setAttr,
  stopControl,
  textOf,
} from './dom.js';
import { formatHex } from './color.js';
import { createTextControl, inputOf, updateTextControl } from './text-field.js';

/** The picker shows black for no colour. */
const PICKER_DEFAULT = '#000000';

const actions = (input) => ({
  'read-value': (args, meta) => {
    const text = input.value.trim();
    const hex = formatHex(text);
    if (text === '') {
      meta.assign({ value: null, invalid: false });
    } else {
      meta.assign(
        hex === null ? { invalid: true } : { value: hex, invalid: false }
      );
    }
  },
  'read-picker': (args, meta) => {
    const picker = input.nextSibling;
    meta.assign({ value: formatHex(picker.value), invalid: false });
  },
  'restore-value': (args, meta) => {
    meta.assign({ invalid: false });
    input.value = meta.context.value ?? '';
  },
});

/** Show the colour in both inputs, then commit it when the user changed it. */
function render(control) {
  const { context } = control.service;
  const { input, indicator } = control.parts;
  if (context.invalid !== true && input.value !== (context.value ?? '')) {
    input.value = context.value ?? '';
  }
  const picked = context.value ?? PICKER_DEFAULT;
  if (indicator.value !== picked) {
    indicator.value = picked;
  }
  commitValue(control);
}

export const COLOR_FIELD_KIND = Object.freeze({
  tag: 'ui-color-field',
  childrenSlot: null,
  attributes: { disabled: 'boolean', invalid: 'boolean' },
  create: (el, ctx) =>
    createTextControl(el, ctx, {
      tag: 'ui-color-field',
      kind: 'color-field',
      attrs: {
        type: 'text',
        autocomplete: 'off',
        spellcheck: 'false',
        maxlength: '7',
      },
      children: (doc, node) => {
        const indicator = partOf(doc, 'input', 'indicator', {
          type: 'color',
          tabindex: '-1',
          'aria-hidden': 'true',
          value: PICKER_DEFAULT,
        });
        node.appendChild(indicator);
        return { indicator };
      },
      actions,
      render,
    }),
  eventTarget: inputOf,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const { input, control } = updateTextControl(node, el, ctx, has);
    const { indicator } = control.parts;
    if (has('disabled')) {
      indicator.toggleAttribute('disabled', control.service.context.disabled);
    }
    if (has('value')) {
      const hex = formatHex(textOf(el, 'value'));
      setAttr(input, 'value', hex ?? '');
      setAttr(indicator, 'value', hex ?? PICKER_DEFAULT);
      receive(control, hex);
    }
  },
  destroy: stopControl,
});
