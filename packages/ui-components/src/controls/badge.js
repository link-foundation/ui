/**
 * `badge`: a short status or count shown next to something. The value is
 * visible; the label, when there is one, completes it for assistive
 * technology only ("3" → "3 unread messages"). `tone` is `neutral`
 * (default), `info`, `success`, `warning` or `error`.
 *
 *   (unread: badge 'unread messages' (value 3) (tone info))
 */

import { atomOf, changesOf, partOf, setAttr, setText } from './dom.js';

export const BADGE_TONES = Object.freeze([
  'neutral',
  'info',
  'success',
  'warning',
  'error',
]);

export const BADGE_KIND = Object.freeze({
  tag: 'ui-badge',
  childrenSlot: null,
  attributes: {},
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-badge');
    const root = partOf(doc, 'span', 'root');
    root.appendChild(partOf(doc, 'span', 'indicator'));
    root.appendChild(partOf(doc, 'span', 'label'));
    node.appendChild(root);
    return node;
  },
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const [value, label] = node.firstChild.children;
    if (has('value') || has('label')) {
      const text = atomOf(el, 'value');
      const name = atomOf(el, 'label');
      setText(value, text ?? name);
      setText(
        label,
        text === undefined || name === undefined ? '' : ` ${name}`
      );
      label.toggleAttribute('hidden', text === undefined || name === undefined);
      if (text === undefined && name === undefined) {
        ctx.diagnostic('missing-label', 'warning', { property: 'value' });
      }
    }
    if (has('tone')) {
      const tone = atomOf(el, 'tone');
      setAttr(node, 'tone', BADGE_TONES.includes(tone) ? tone : 'neutral');
    }
  },
});
