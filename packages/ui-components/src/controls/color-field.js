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
  setText,
} from './dom.js';
import { formatColor as formatHex } from './color.js';
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
        maxlength: '32',
      },
      children: (doc, node) => {
        const indicator = partOf(doc, 'input', 'indicator', {
          type: 'color',
          tabindex: '-1',
          'aria-hidden': 'true',
          value: PICKER_DEFAULT,
        });
        node.appendChild(indicator);
        const palette = partOf(doc, 'div', 'palette', {
          role: 'group',
          'aria-label': 'Palette',
        });
        node.appendChild(palette);
        return { indicator, palette };
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
    control.parts.palette.setAttribute(
      'aria-label',
      `${textOf(el, 'label') || el.id} palette`
    );
    if (has('palette')) {
      const palette = control.parts.palette;
      setText(palette, '');
      for (const pair of el.props.get('palette') ?? []) {
        const values = Array.isArray(pair) ? pair : pair?.values;
        if (!Array.isArray(values) || values.length !== 2) {
          continue;
        }
        const [name, raw] = values;
        const color = formatHex(raw);
        if (!color) {
          continue;
        }
        const button = partOf(ctx.document, 'button', null, { type: 'button' });
        setText(button, name);
        button.addEventListener('click', () => {
          if (!control.service.context.disabled) {
            control.assign({ value: color, invalid: false });
          }
        });
        palette.appendChild(button);
      }
    }
    control.parts.palette.toggleAttribute(
      'hidden',
      control.parts.palette.children.length === 0
    );
    for (const button of control.parts.palette.children) {
      button.toggleAttribute('disabled', control.service.context.disabled);
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
