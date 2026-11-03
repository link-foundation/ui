/**
 * `option`: one choice of a `select` or a `combobox` (`role=option`). Its
 * `value` defaults to its ID, its label to the value.
 *
 *   (m: option 'Medium' (value m))
 */

import { choiceLabel, choiceValue, wasChosen } from './choices.js';
import {
  atomOf,
  changesOf,
  flagOf,
  partId,
  partOf,
  setAttr,
  setText,
} from './dom.js';

export const OPTION_KIND = Object.freeze({
  tag: 'ui-option',
  childrenSlot: null,
  attributes: { disabled: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-option');
    node.setAttribute('role', 'option');
    node.setAttribute('id', partId(el.id, 'option'));
    node.setAttribute('aria-selected', String(wasChosen(ctx, el.id)));
    node.appendChild(
      partOf(doc, 'span', 'indicator', { 'aria-hidden': 'true' })
    );
    node.appendChild(partOf(doc, 'span', 'label'));
    return node;
  },
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    if (has('label') || has('value')) {
      setText(node.children[1], choiceLabel(el));
      if (atomOf(el, 'label') === undefined) {
        ctx.diagnostic('missing-label', 'warning', { property: 'label' });
      }
    }
    if (has('value')) {
      node.setAttribute('data-value', choiceValue(el));
    }
    if (has('disabled')) {
      setAttr(
        node,
        'aria-disabled',
        flagOf(el, 'disabled') ? 'true' : undefined
      );
    }
  },
});
