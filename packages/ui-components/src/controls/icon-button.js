/**
 * `icon-button`: a button that shows only an icon. Its `label` is the
 * accessible name (`aria-label`) and the tooltip (`title`); without one
 * the button has no name, which is a `missing-label` error.
 *
 *   (close: icon-button close (label 'Close') (on press (emit close)))
 */

import { createButton, updateButton } from './button.js';
import { atomOf, changesOf, setAttr, stopControl } from './dom.js';

export const ICON_BUTTON_KIND = Object.freeze({
  tag: 'ui-icon-button',
  childrenSlot: null,
  attributes: { variant: 'string', disabled: 'boolean' },
  create: (el, ctx) =>
    createButton(el, ctx, { tag: 'ui-icon-button', kind: 'icon-button' }),
  eventTarget: (node) => node.firstChild,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    updateButton(node, el, has);
    if (has('label')) {
      const label = atomOf(el, 'label');
      const button = node.firstChild;
      setAttr(button, 'aria-label', label || undefined);
      setAttr(button, 'title', label || undefined);
      if (!label) {
        ctx.diagnostic('missing-label', 'error', { property: 'label' });
      }
    }
  },
  destroy: stopControl,
});
