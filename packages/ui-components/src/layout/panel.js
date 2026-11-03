/**
 * `panel`: a titled panel, the content of a tab of a tab group or of a dock.
 * Its `title` and `closable` are written as `data-title` and
 * `data-closable`, which the tab group or the dock reads.
 *
 *   (outline: panel (title Outline) (closable true) ...)
 */

import { defineKind } from '@link-foundation/ui-dom';
import { atomOf, setAttr } from './dom.js';

defineKind('panel', {
  tag: 'ui-panel',
  create: (el, ctx) => ctx.document.createElement('ui-panel'),
  update(node, el, changed) {
    if (changed.includes('title')) {
      setAttr(node, 'data-title', atomOf(el, 'title') ?? el.name ?? undefined);
    }
    if (changed.includes('closable')) {
      setAttr(node, 'data-closable', atomOf(el, 'closable'));
    }
    if (!node.hasAttribute('data-title') && el.name !== null) {
      node.setAttribute('data-title', el.name);
    }
  },
});
