/**
 * The chosen child of a choice control (`radio-group` with `radio`
 * children, `select` and `combobox` with `option` children).
 *
 * A live control marks its children itself (it watches them); in the
 * static document of `renderToHTML` the children are rendered after their
 * parent, so the parent records which child IDs are chosen here and the
 * child reads it when it renders.
 */

import { atomOf, isLive } from './dom.js';

const chosen = new WeakMap();

/** The value of a choice child: its `value`, else its ID. */
export const choiceValue = (el) => atomOf(el, 'value') ?? el.id;

/**
 * Record (static rendering) which children of a choice control are
 * chosen: the ones whose value is `value`.
 */
export function recordChosen(ctx, value) {
  if (isLive(ctx)) {
    return;
  }
  let ids = chosen.get(ctx.document);
  if (ids === undefined) {
    ids = new Set();
    chosen.set(ctx.document, ids);
  }
  for (const child of ctx.children()) {
    if (value !== null && choiceValue(child) === value) {
      ids.add(child.id);
    } else {
      ids.delete(child.id);
    }
  }
}

/** Whether a child was recorded as chosen (static rendering). */
export const wasChosen = (ctx, id) =>
  chosen.get(ctx.document)?.has(id) === true;

/** The visible label of a choice child (its `label`, else its value). */
export const choiceLabel = (el) => atomOf(el, 'label') ?? choiceValue(el);
