/**
 * The typed editors of the property grid, built from native form controls:
 * a text field, a number field, a number with a unit, a colour picker, a
 * select for an enum, a switch for a boolean and a token reference field.
 * Every editor writes through `onEdit(value)`, which applies the value to
 * the session layer at once.
 */

import { values as uiValues } from '@link-foundation/ui-core';
import { tokenPath } from './model.js';

/** The single atom of a value, or `undefined`. */
const atomOf = (values) =>
  Array.isArray(values) && values.length === 1 && typeof values[0] === 'string'
    ? values[0]
    : undefined;

/** `#rrggbb` for an `<input type=color>`, or `undefined`. */
function hexOf(text) {
  const parsed = text === undefined ? null : uiValues.parseColor(text);
  return parsed ? uiValues.toHex(parsed).slice(0, 7).toLowerCase() : undefined;
}

const el = (doc, tag, attributes = {}) => {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
};

/** Whether a control has the focus (then it is not overwritten). */
const focused = (node) => node.getRootNode().activeElement === node;

/** Set a control's value unless the user is typing in it. */
function setValue(control, value) {
  if (!focused(control) && control.value !== value) {
    control.value = value;
  }
}

/** The number of token lists made, for unique `datalist` ids. */
let lists = 0;

const BUILDERS = {
  string(doc) {
    const input = el(doc, 'input', { type: 'text' });
    return {
      controls: [input],
      read: () => input.value,
      write: (r) => setValue(input, atomOf(r.value) ?? r.text),
      events: [[input, 'input']],
      skip: () => input.value === '',
    };
  },
  number(doc) {
    const input = el(doc, 'input', { type: 'number', step: 'any' });
    return {
      controls: [input],
      read: () => input.value,
      write: (r) => setValue(input, atomOf(r.value) ?? ''),
      events: [[input, 'input']],
      skip: () => input.value === '',
    };
  },
  dimension(doc, row, t) {
    const input = el(doc, 'input', { type: 'number', step: 'any' });
    const unit = el(doc, 'select', {
      'aria-label': t('properties.unitLabel', { name: row.label }),
    });
    for (const name of row.units) {
      const option = el(doc, 'option', { value: name });
      option.textContent = name;
      unit.append(option);
    }
    return {
      controls: [input, unit],
      read: () => `${input.value}${unit.value}`,
      write(r) {
        const quantity = uiValues.splitQuantity(atomOf(r.value) ?? '', r.units);
        setValue(input, quantity ? String(quantity.value) : '');
        setValue(unit, quantity?.unit ?? r.units[0]);
      },
      events: [
        [input, 'input'],
        [unit, 'change'],
      ],
      skip: () => input.value === '',
    };
  },
  color(doc) {
    const input = el(doc, 'input', { type: 'color' });
    return {
      controls: [input],
      read: () => input.value,
      write: (r) => setValue(input, hexOf(atomOf(r.value)) ?? '#000000'),
      events: [[input, 'input']],
    };
  },
  enum(doc, row, t) {
    const select = el(doc, 'select');
    const unset = el(doc, 'option', { value: '', disabled: '' });
    unset.textContent = t('properties.unset');
    select.append(unset);
    for (const name of row.options) {
      const option = el(doc, 'option', { value: name });
      option.textContent = name;
      select.append(option);
    }
    return {
      controls: [select],
      read: () => select.value,
      write: (r) => setValue(select, atomOf(r.value) ?? ''),
      events: [[select, 'change']],
      skip: () => select.value === '',
    };
  },
  boolean(doc) {
    const input = el(doc, 'input', { type: 'checkbox', role: 'switch' });
    return {
      controls: [input],
      read: () => String(input.checked),
      write(r) {
        input.checked = atomOf(r.value) === 'true';
      },
      events: [[input, 'change']],
    };
  },
  token(doc, row, t, tokenPaths) {
    const input = el(doc, 'input', { type: 'text' });
    const controls = [input];
    if (tokenPaths.length > 0) {
      lists += 1;
      const list = el(doc, 'datalist', { id: `devmode-token-paths-${lists}` });
      for (const path of tokenPaths) {
        list.append(el(doc, 'option', { value: path }));
      }
      input.setAttribute('list', list.id);
      controls.push(list);
    }
    return {
      controls,
      read: () => ({ token: input.value }),
      write: (r) => setValue(input, tokenPath(r.value) ?? ''),
      events: [[input, 'input']],
      skip: () => input.value === '',
    };
  },
};

/**
 * The editor of a property row.
 * @param {Document} doc
 * @param {import('./model.js').PropertyRow} row
 * @param {{ t: (key: string, params?: object) => string,
 *   onEdit: (value: unknown) => string|null,
 *   tokenPaths?: readonly string[] }} options  `onEdit` returns an error
 *   message, or `null` when the value was applied
 * @returns {{ node: HTMLElement, update: (row: import('./model.js').PropertyRow) => void }}
 */
export function createEditor(doc, row, { t, onEdit, tokenPaths = [] }) {
  const node = el(doc, 'div', { class: 'editor' });
  if (row.editor === 'readonly') {
    node.textContent = '—';
    return { node, update() {} };
  }
  const editor = BUILDERS[row.editor](doc, row, t, tokenPaths);
  const [main] = editor.controls;
  main.setAttribute('aria-label', row.label);
  node.append(...editor.controls);
  const commit = () => {
    if (editor.skip?.()) {
      return;
    }
    const error = onEdit(editor.read());
    main.setAttribute('aria-invalid', String(error !== null));
    if (error === null) {
      main.removeAttribute('title');
    } else {
      main.title = error;
    }
  };
  for (const [control, type] of editor.events) {
    control.addEventListener(type, commit);
  }
  const update = (next) => {
    editor.write(next);
    for (const control of editor.controls) {
      control.disabled = !next.writable;
    }
  };
  update(row);
  return { node, update };
}
