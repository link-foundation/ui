/**
 * `text-area`: a native `<textarea>` with its `<label>`, committed like
 * `text-field` (on the native `change`); `rows` sets its height in lines.
 *
 *   (bio: text-area 'About you' (name bio) (rows 4))
 */

import { changesOf, numberOf, setAttr, stopControl, textOf } from './dom.js';
import {
  createTextControl,
  inputOf,
  receiveText,
  updateTextControl,
} from './text-field.js';

export const TEXT_AREA_KIND = Object.freeze({
  tag: 'ui-text-area',
  childrenSlot: null,
  attributes: { disabled: 'boolean', invalid: 'boolean' },
  create: (el, ctx) =>
    createTextControl(el, ctx, {
      tag: 'ui-text-area',
      kind: 'text-area',
      element: 'textarea',
    }),
  eventTarget: inputOf,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const { input, control } = updateTextControl(node, el, ctx, has);
    if (has('rows')) {
      const rows = numberOf(el, 'rows', 0);
      setAttr(input, 'rows', rows >= 1 ? String(Math.round(rows)) : undefined);
    }
    if (has('value')) {
      receiveText(input, control, textOf(el, 'value'));
    }
  },
  destroy: stopControl,
});
