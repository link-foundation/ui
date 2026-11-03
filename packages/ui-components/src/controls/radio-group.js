/**
 * `radio-group` and its `radio` children: one choice among several, a
 * single tab stop (`createRovingTabindex`). Tab reaches the checked radio
 * (or the first), the arrow keys move focus and check the radio they
 * reach (APG), Space checks the focused one. The group's `value` is the
 * `value` (else the ID) of its checked radio; a form submits it under the
 * group's `name`.
 *
 *   (size: radio-group 'Size' (name size) (value m)
 *     (s: radio 'Small') (m: radio 'Medium') (l: radio 'Large'))
 */

import { createRovingTabindex } from '../a11y/roving.js';
import { watchChildren } from '../layout/dom.js';
import {
  choiceLabel,
  choiceValue,
  recordChosen,
  wasChosen,
} from './choices.js';
import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  flagOf,
  isLive,
  partId,
  partOf,
  receive,
  setAttr,
  setText,
  startControl,
  stopControl,
  updateLabel,
} from './dom.js';

const RADIO = ':scope > ui-radio > [role="radio"]';

/** The radio buttons of a group root. */
const radiosOf = (root) => [...root.querySelectorAll(RADIO)];

/** The value of a radio button (set by the `radio` kind). */
const valueOf = (radio) => radio.parentNode.getAttribute('data-value');

/** Sync the form input and the radios, then commit a user change. */
function render(control) {
  const { value, disabled } = control.service.context;
  setAttr(control.hidden, 'value', value ?? '');
  control.hidden.toggleAttribute(
    'disabled',
    value === null || value === undefined
  );
  if (control.roving) {
    renderRadios(control, value, disabled);
  }
  commitValue(control);
}

/** Check the radio of the value and keep it the tab stop (live). */
function renderRadios(control, value, disabled) {
  const { root } = control.parts;
  let checked = -1;
  radiosOf(root).forEach((radio, i) => {
    const on =
      value !== null && value !== undefined && valueOf(radio) === value;
    if (on) {
      checked = i;
    }
    setAttr(radio, 'aria-checked', String(on));
    radio.toggleAttribute(
      'disabled',
      disabled === true || radio.parentNode.hasAttribute('disabled')
    );
  });
  const focused = root.contains(root.ownerDocument.activeElement);
  if (checked !== -1 && !focused) {
    control.roving.select(checked);
  }
  control.roving.update();
}

/** Make the group interactive: roving focus, click and Space selection. */
function connect(control, root) {
  let pending = null;
  const send = (radio) => {
    pending = radio;
    control.service.send('select');
    pending = null;
  };
  control.choose = (args, meta) => {
    const radio =
      pending ?? root.ownerDocument.activeElement?.closest?.('[role="radio"]');
    if (radio && radiosOf(root).includes(radio) && !radio.disabled) {
      meta.assign({ value: valueOf(radio) });
    }
  };
  control.roving = createRovingTabindex(() => radiosOf(root), {
    orientation: 'both',
    onChange: (index, radio) => send(radio),
  });
  const detach = control.roving.attach(root);
  const onClick = (event) => {
    pending = event.target.closest?.('[role="radio"]') ?? null;
  };
  root.addEventListener('click', onClick, true);
  const observer = watchChildren(root, () => render(control), [
    'data-value',
    'disabled',
  ]);
  return () => {
    detach();
    root.removeEventListener('click', onClick, true);
    observer.disconnect();
  };
}

export const RADIO_GROUP_KIND = Object.freeze({
  tag: 'ui-radio-group',
  childrenSlot: (node) => node.children[1],
  attributes: {
    disabled: 'boolean',
    invalid: 'boolean',
    orientation: 'string',
  },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-radio-group');
    const labelId = partId(el.id, 'label');
    const label = partOf(doc, 'span', 'label', { id: labelId });
    const root = partOf(doc, 'div', 'root', { 'aria-labelledby': labelId });
    const hidden = partOf(doc, 'input', null, { type: 'hidden', disabled: '' });
    node.appendChild(label);
    node.appendChild(root);
    node.appendChild(hidden);
    let control = null;
    control = startControl(node, el, ctx, {
      kind: 'radio-group',
      parts: { root, label },
      target: root,
      actions: { 'choose-radio': (args, meta) => control.choose?.(args, meta) },
      render: (c) => render(c),
    });
    control.hidden = hidden;
    if (isLive(ctx)) {
      const disconnect = connect(control, root);
      const stop = control.stop;
      control.stop = () => {
        disconnect();
        stop();
      };
    }
    return node;
  },
  eventTarget: (node) => node.children[1],
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    if (has('label')) {
      updateLabel(control.parts.label, el, ctx);
    }
    if (has('name')) {
      setAttr(control.hidden, 'name', atomOf(el, 'name'));
    }
    if (has('orientation')) {
      const vertical = atomOf(el, 'orientation') === 'vertical';
      setAttr(
        control.parts.root,
        'aria-orientation',
        vertical ? 'vertical' : 'horizontal'
      );
    }
    if (has('required')) {
      const required = flagOf(el, 'required');
      setAttr(
        control.parts.root,
        'aria-required',
        required ? 'true' : undefined
      );
    }
    for (const name of ['disabled', 'invalid']) {
      if (has(name)) {
        control.assign({ [name]: flagOf(el, name) });
      }
    }
    if (has('value')) {
      const value = atomOf(el, 'value') ?? null;
      recordChosen(ctx, value);
      receive(control, value);
    }
    render(control);
  },
  destroy: stopControl,
});

export const RADIO_KIND = Object.freeze({
  tag: 'ui-radio',
  childrenSlot: null,
  attributes: { disabled: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-radio');
    const input = partOf(doc, 'button', 'input', {
      type: 'button',
      role: 'radio',
      id: partId(el.id),
      'aria-checked': String(wasChosen(ctx, el.id)),
      tabindex: wasChosen(ctx, el.id) ? '0' : '-1',
    });
    input.appendChild(
      partOf(doc, 'span', 'indicator', { 'aria-hidden': 'true' })
    );
    input.appendChild(partOf(doc, 'span', 'label'));
    node.appendChild(input);
    return node;
  },
  eventTarget: (node) => node.firstChild,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const input = node.firstChild;
    if (has('label') || has('value')) {
      setText(input.children[1], choiceLabel(el));
      if (atomOf(el, 'label') === undefined) {
        ctx.diagnostic('missing-label', 'warning', { property: 'label' });
      }
    }
    if (has('value')) {
      node.setAttribute('data-value', choiceValue(el));
    }
    if (has('disabled')) {
      input.toggleAttribute('disabled', flagOf(el, 'disabled'));
    }
  },
});
