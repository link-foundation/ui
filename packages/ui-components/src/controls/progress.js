/**
 * `progress`: a `progressbar` from 0 to `max` (default 100). Without a
 * `value` it is indeterminate: `aria-valuenow` is left out (the APG
 * reading of "busy, amount unknown") and the indicator animates.
 *
 *   (upload: progress 'Uploading' (value 40))
 *   (busy: progress 'Loading')
 *
 * `(shape circular)` draws the same progressbar as a ring; the ARIA is the
 * same in both shapes.
 *
 *   (sync: progress 'Syncing' (shape circular) (value 40))
 *   (spinner: progress 'Loading' (shape circular))
 */

import {
  atomOf,
  changesOf,
  numberOf,
  partId,
  partOf,
  setAttr,
  updateLabel,
} from './dom.js';

export const PROGRESS_SHAPES = Object.freeze(['linear', 'circular']);

export const PROGRESS_KIND = Object.freeze({
  tag: 'ui-progress',
  childrenSlot: null,
  attributes: {},
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-progress');
    const labelId = partId(el.id, 'label');
    const label = partOf(doc, 'span', 'label', { id: labelId });
    const track = partOf(doc, 'div', 'track', {
      role: 'progressbar',
      id: partId(el.id),
      'aria-labelledby': labelId,
      'aria-valuemin': '0',
    });
    track.appendChild(partOf(doc, 'div', 'indicator'));
    node.appendChild(label);
    node.appendChild(track);
    return node;
  },
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const [label, track] = node.children;
    if (has('label')) {
      updateLabel(label, el, ctx);
    }
    if (has('shape')) {
      const shape = atomOf(el, 'shape');
      setAttr(node, 'shape', PROGRESS_SHAPES.includes(shape) ? shape : 'linear');
    }
    if (has('value') || has('max')) {
      const max = Math.max(Number.MIN_VALUE, numberOf(el, 'max', 100));
      const raw = numberOf(el, 'value', Number.NaN);
      const known = Number.isFinite(raw);
      const value = known ? Math.min(max, Math.max(0, raw)) : null;
      setAttr(track, 'aria-valuemax', String(max));
      setAttr(track, 'aria-valuenow', known ? String(value) : undefined);
      node.toggleAttribute('data-indeterminate', !known);
      node.style.setProperty(
        '--ui-progress-value',
        known ? String(value / max) : '0'
      );
    }
  },
});
