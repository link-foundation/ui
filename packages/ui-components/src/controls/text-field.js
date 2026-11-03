/**
 * `text-field`: a native `<input>` with its `<label>`. The value is
 * committed on the native `change` (Enter or leaving the field): one
 * `ui-change` per new value. Escape restores the last committed value.
 * Typing never reaches a key binding: the machine binds only Escape, and
 * `bindKeys` leaves text fields alone.
 *
 *   (email: text-field 'Email' (name email) (type email) (required true))
 */

import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  flagOf,
  partId,
  partOf,
  setAttr,
  setText,
  startControl,
  stopControl,
  textOf,
  updateLabel,
} from './dom.js';

const TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url']);

/** The input (or textarea) of a text control node (after its label). */
export const inputOf = (node) => node.children[1];

/**
 * Build `<tag><label data-part=label><input data-part=input></tag>` and
 * start the machine of `kind`.
 * @param {{tag: string, kind: string, element?: string,
 *   attrs?: Record<string, string>, actions?: Record<string, Function>,
 *   ignoreInFields?: boolean, render?: Function, children?: Function}} spec
 */
export function createTextControl(el, ctx, spec) {
  const doc = ctx.document;
  const id = partId(el.id);
  const node = doc.createElement(spec.tag);
  const label = partOf(doc, 'label', 'label', { for: id });
  const input = partOf(doc, spec.element ?? 'input', 'input', {
    id,
    ...spec.attrs,
  });
  node.appendChild(label);
  node.appendChild(input);
  const extra = spec.children?.(doc, node) ?? {};
  const control = startControl(node, el, ctx, {
    kind: spec.kind,
    parts: { label, input, ...extra },
    target: input,
    ignoreInFields: spec.ignoreInFields,
    actions: {
      'read-value': (args, meta) => meta.assign({ value: input.value }),
      'restore-value': (args, meta) => {
        input.value = control.value ?? '';
        meta.assign({ value: control.value });
      },
      ...spec.actions?.(input, () => control),
    },
    render: spec.render ?? ((c) => commitValue(c)),
  });
  return node;
}

/** Apply the properties every text control has. */
export function updateTextControl(node, el, ctx, has) {
  const control = controlOf(node);
  const { input } = control.parts;
  if (has('label')) {
    updateLabel(node.firstChild, el, ctx);
  }
  for (const name of ['name', 'placeholder', 'autocomplete']) {
    if (has(name)) {
      setAttr(input, name, atomOf(el, name));
    }
  }
  for (const name of ['required', 'readonly', 'disabled', 'invalid']) {
    if (has(name)) {
      const on = flagOf(el, name);
      if (name !== 'invalid') {
        input.toggleAttribute(name, on);
      }
      control.assign({ [name]: on });
    }
  }
  return { input, control };
}

/** Show the value of a property in a text input and in the machine. */
export function receiveText(input, control, value) {
  if (input.value !== value) {
    input.value = value;
  }
  if (input.localName === 'textarea') {
    // The default value of a textarea is its text (also in static HTML).
    setText(input, value);
  } else {
    input.setAttribute('value', value);
  }
  control.value = value;
  control.assign({ value });
}

export const TEXT_FIELD_KIND = Object.freeze({
  tag: 'ui-text-field',
  childrenSlot: null,
  attributes: { variant: 'string', disabled: 'boolean', invalid: 'boolean' },
  create: (el, ctx) =>
    createTextControl(el, ctx, {
      tag: 'ui-text-field',
      kind: 'text-field',
      attrs: { type: 'text' },
    }),
  eventTarget: inputOf,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const { input, control } = updateTextControl(node, el, ctx, has);
    if (has('type')) {
      const type = atomOf(el, 'type');
      input.setAttribute('type', TYPES.has(type) ? type : 'text');
    }
    if (has('value')) {
      receiveText(input, control, textOf(el, 'value'));
    }
  },
  destroy: stopControl,
});
