/**
 * `color-field`: a hex text input and the native colour picker
 * (`<input type=color>`, the `indicator` part) side by side. Both commit
 * the normalised `#rrggbb`; text that is not a hex colour makes the field
 * invalid and keeps the last colour. Escape restores it.
 *
 *   (accent: color-field 'Accent' (name accent) (value '#6750a4'))
 */

import { contrastRatio } from '@link-foundation/ui-tokens/themes';
import {
  changesOf,
  commitValue,
  partOf,
  receive,
  setAttr,
  stopControl,
  textOf,
  setText,
  flagOf,
} from './dom.js';
import { colorPopover, paletteGroups } from './color-popover.js';
import { createRgb, renderRgb, updateRgb } from './color-rgb.js';
import { formatColor as formatHex } from './color.js';
import { createTextControl, inputOf, updateTextControl } from './text-field.js';

/** The picker shows black for no colour. */
const PICKER_DEFAULT = '#000000';

function paintSwatch(node, color) {
  node.style.backgroundColor = color;
  node.style.color =
    contrastRatio('#000000', color) >= 4.5 ? '#000000' : '#ffffff';
}

const actions = (input, getControl) => ({
  'read-value': (args, meta) => {
    const text = input.value.trim();
    const strict = getControl().strictHex;
    const hex =
      strict && !/^#[0-9a-f]{6}$/i.test(input.value) ? null : formatHex(text);
    if (text === '' && !strict) {
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
  renderRgb(control);
  if (control.parts.swatch) {
    paintSwatch(control.parts.swatch, picked);
  }
  for (const chip of control.parts.palette.querySelectorAll('[data-color]')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.color === picked));
  }
  commitValue(control);
}

function updatePalette(control, el, doc) {
  const palette = control.parts.palette;
  setText(palette, '');
  const groups = paletteGroups(el.props.get('palettes'));
  for (const group of groups) {
    const fieldset = partOf(doc, 'fieldset', null);
    const legend = partOf(doc, 'legend', null);
    setText(legend, group.name);
    fieldset.append(legend);
    palette.append(fieldset);
    for (const item of group.colors ?? []) {
      const color = formatHex(item.hex);
      if (!color) {
        continue;
      }
      const chip = partOf(doc, 'button', null, {
        type: 'button',
        'aria-label': `${item.name} ${color}`,
      });
      chip.dataset.color = color;
      setText(chip, item.name);
      paintSwatch(chip, color);
      chip.addEventListener('click', () => {
        if (
          !control.service.context.disabled &&
          !control.service.context.readonly
        ) {
          control.assign({ value: color, invalid: false });
        }
      });
      fieldset.append(chip);
    }
  }
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
    const button = partOf(doc, 'button', null, { type: 'button' });
    setText(button, name);
    button.dataset.color = color;
    button.setAttribute('aria-label', `${name} ${color}`);
    button.addEventListener('click', () => {
      if (
        !control.service.context.disabled &&
        !control.service.context.readonly
      ) {
        control.assign({ value: color, invalid: false });
      }
    });
    palette.appendChild(button);
  }
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
      children: (doc, node, getControl) => {
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
        return { indicator, palette, ...createRgb(doc, node, getControl) };
      },
      actions,
      render,
    }),
  eventTarget: inputOf,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const { input, control } = updateTextControl(node, el, ctx, has);
    control.strictHex = textOf(el, 'mode') === 'popover';
    colorPopover(control, el);
    control.parts.swatch ??= node.querySelector('[data-part=swatch]');
    control.popover?.update(el);
    const { indicator } = control.parts;
    const disabled = flagOf(el, 'disabled') || flagOf(el, 'readonly');
    indicator.toggleAttribute('disabled', disabled);
    control.parts.palette.setAttribute(
      'aria-label',
      textOf(el, 'palette-label') || `${textOf(el, 'label') || el.id} palette`
    );
    if (has('palette') || has('palettes')) {
      updatePalette(control, el, ctx.document);
      render(control);
    }
    control.parts.palette.toggleAttribute(
      'hidden',
      control.parts.palette.children.length === 0
    );
    for (const button of control.parts.palette.querySelectorAll('button')) {
      button.toggleAttribute('disabled', disabled);
    }
    updateRgb(control, el);
    if (control.strictHex) {
      control.parts.rgb.hidden = false;
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
