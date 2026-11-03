/**
 * `button`: a native `<button>` (keyboard activation, focus and the button
 * role for free) with an optional icon and a label. The machine
 * (`button-machine`) tracks the pressed state for styling; activation is
 * the native click, which ui-dom maps to `(on press ...)`.
 *
 *   (save: button 'Save' (variant filled) (icon check) (on press (emit save)))
 */

import { buttonParts } from './button-template.js';
import { defineIconElement } from '../icons/icon.js';
import {
  atomOf,
  changesOf,
  flagOf,
  isLive,
  partId,
  partOf,
  setAttr,
  setText,
  startControl,
  stopControl,
  controlOf,
} from './dom.js';

const TYPES = new Set(['button', 'submit', 'reset']);

/** The native button of a button node. */
const buttonOf = (node) => node.firstChild;

/**
 * Build `<tag><button data-part=root><ui-icon data-part=icon>
 * <span data-part=label></button></tag>` and start the machine.
 */
export function createButton(el, ctx, { tag, kind }) {
  const doc = ctx.document;
  if (isLive(ctx)) {
    defineIconElement(doc.defaultView);
  }
  const node = doc.createElement(tag);
  const button = partOf(doc, 'button', 'root', {
    type: 'button',
    id: partId(el.id),
  });
  const icon = partOf(doc, 'ui-icon', 'icon', { 'aria-hidden': 'true' });
  const label = partOf(doc, 'span', 'label');
  if (!buttonParts(button, ctx, kind)) {
    button.appendChild(icon);
    button.appendChild(label);
  }
  node.appendChild(button);
  startControl(node, el, ctx, {
    kind,
    parts: { root: button },
    target: button,
  });
  return node;
}

/** Apply the properties every button kind has. */
export function updateButton(node, el, has) {
  const button = buttonOf(node);
  const icon = button.querySelector('[data-part="icon"]');
  if (has('icon')) {
    setAttr(icon, 'name', atomOf(el, 'icon'));
    icon.toggleAttribute('hidden', atomOf(el, 'icon') === undefined);
  }
  if (has('type')) {
    const type = atomOf(el, 'type');
    button.setAttribute('type', TYPES.has(type) ? type : 'button');
  }
  if (has('disabled')) {
    const disabled = flagOf(el, 'disabled');
    button.toggleAttribute('disabled', disabled);
    controlOf(node)?.assign({ disabled });
  }
}

export const BUTTON_KIND = Object.freeze({
  tag: 'ui-button',
  childrenSlot: null,
  attributes: { variant: 'string', disabled: 'boolean' },
  create: (el, ctx) =>
    createButton(el, ctx, { tag: 'ui-button', kind: 'button' }),
  eventTarget: buttonOf,
  update(node, el, changed) {
    const has = changesOf(node, changed);
    updateButton(node, el, has);
    if (has('label')) {
      setText(
        buttonOf(node).querySelector('[data-part="label"]'),
        atomOf(el, 'label')
      );
    }
  },
  destroy: stopControl,
});
