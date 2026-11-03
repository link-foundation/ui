/**
 * `checkbox`: a native `<input type=checkbox>` in its `<label>`.
 * `(checked mixed)` is the indeterminate state (shown with the native
 * `indeterminate` flag, read as "mixed"); the next toggle checks it.
 * A form submits `value` (default `on`) when it is checked.
 *
 *   (terms: checkbox 'I accept the terms' (name terms) (required true))
 *   (all: checkbox 'Select all' (checked mixed))
 */

import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  flagOf,
  partId,
  partOf,
  receive,
  setAttr,
  setText,
  startControl,
  stopControl,
} from './dom.js';

/** The `checked` property: `true`, `false` or `'mixed'`. */
export function checkedOf(el) {
  const value = atomOf(el, 'checked');
  if (value === 'mixed') {
    return 'mixed';
  }
  return value === 'true';
}

/** Show the state on the native input, then commit a user change. */
function render(control) {
  const { input } = control.parts;
  const checked = control.service.context.checked;
  input.checked = checked === true;
  input.indeterminate = checked === 'mixed';
  commitValue(control, 'checked', checked);
}

/** `<tag><label data-part=root><input data-part=input><span data-part=indicator><span data-part=label></label></tag>` */
export function createCheckControl(el, ctx, tag, inputAttrs) {
  const doc = ctx.document;
  const node = doc.createElement(tag);
  const root = partOf(doc, 'label', 'root');
  const input = partOf(doc, 'input', 'input', {
    id: partId(el.id),
    ...inputAttrs,
  });
  const indicator = partOf(doc, 'span', 'indicator', { 'aria-hidden': 'true' });
  const label = partOf(doc, 'span', 'label');
  root.appendChild(input);
  root.appendChild(indicator);
  root.appendChild(label);
  node.appendChild(root);
  return { node, input, indicator, label };
}

export const CHECKBOX_KIND = Object.freeze({
  tag: 'ui-checkbox',
  childrenSlot: null,
  attributes: { disabled: 'boolean', invalid: 'boolean' },
  create(el, ctx) {
    const { node, input, label } = createCheckControl(el, ctx, 'ui-checkbox', {
      type: 'checkbox',
    });
    startControl(node, el, ctx, {
      kind: 'checkbox',
      parts: { input, label },
      target: input,
      render,
    });
    return node;
  },
  eventTarget: (node) => node.firstChild.firstChild,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    const { input, label } = control.parts;
    if (has('label')) {
      const text = atomOf(el, 'label');
      setText(label, text);
      if (text === undefined || text === '') {
        ctx.diagnostic('missing-label', 'warning', { property: 'label' });
      }
    }
    if (has('name')) {
      setAttr(input, 'name', atomOf(el, 'name'));
    }
    if (has('value')) {
      setAttr(input, 'value', atomOf(el, 'value') ?? 'on');
    }
    for (const name of ['disabled', 'required', 'invalid']) {
      if (has(name)) {
        const on = flagOf(el, name);
        if (name !== 'invalid') {
          input.toggleAttribute(name, on);
        }
        control.assign({ [name]: on });
      }
    }
    if (has('checked')) {
      const checked = checkedOf(el);
      input.toggleAttribute('checked', checked === true);
      receive(control, checked, { checked });
    }
  },
  destroy: stopControl,
});
