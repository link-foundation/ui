/**
 * `label`: the visible name of a form control. `(for ID)` names the
 * control of the store element `ID` (its input, `<label for>`);
 * `(required true)` adds a required marker that assistive technology
 * does not read (the control itself is `required`).
 *
 *   (email-label: label 'Email' (for email) (required true))
 */

import {
  atomOf,
  changesOf,
  flagOf,
  partId,
  partOf,
  setAttr,
  setText,
} from './dom.js';

export const LABEL_KIND = Object.freeze({
  tag: 'ui-label',
  childrenSlot: null,
  attributes: { required: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-label');
    const label = partOf(doc, 'label', 'label');
    label.appendChild(doc.createElement('span'));
    const indicator = partOf(doc, 'span', 'indicator', {
      'aria-hidden': 'true',
    });
    indicator.appendChild(doc.createTextNode('*'));
    label.appendChild(indicator);
    node.appendChild(label);
    return node;
  },
  update(node, el, changed) {
    const has = changesOf(node, changed);
    const label = node.firstChild;
    const [text, indicator] = label.children;
    if (has('value')) {
      setText(text, atomOf(el, 'value'));
    }
    if (has('for')) {
      const target = atomOf(el, 'for');
      setAttr(label, 'for', target === undefined ? undefined : partId(target));
    }
    if (has('required')) {
      indicator.toggleAttribute('hidden', !flagOf(el, 'required'));
    }
  },
});
