/**
 * Apply store events to the rendered tree, in order, from the data of each
 * event (not from the current store state, which may already be ahead):
 *
 * - insert: render the element (`after`) at `index` of `parentId`;
 * - update: the kind's `update` with the one changed property name;
 * - move: `insertBefore` at the new place;
 * - remove: `destroy`, then drop the node and its map entries;
 * - rename: rewrite `data-link-id` and both maps.
 *
 * An event that does not match the tree is reported, never thrown.
 */

import { diagnostic } from './diagnostics.js';

/**
 * @param {ReturnType<typeof import('./tree.js').createTree>} tree
 * @param {readonly import('@link-foundation/ui-store').StoreEvent[]} events
 * @param {(d: object) => void} report
 */
export function applyEvents(tree, events, report) {
  for (const event of events) {
    let ok;
    switch (event.type) {
      case 'insert':
        ok = event.after !== null && typeof event.after === 'object';
        if (ok) {
          tree.insert(event.after, event.parentId, event.index);
        }
        break;
      case 'update':
        ok = tree.update(event.id, event.props ?? [], [event.prop]);
        break;
      case 'move':
        ok = tree.move(
          event.id,
          event.after?.parentId ?? null,
          event.after?.index
        );
        break;
      case 'remove':
        ok = tree.remove(event.id);
        break;
      case 'rename':
        ok = tree.rename(event.before, event.after);
        break;
      default:
        ok = false;
    }
    if (!ok) {
      report(
        diagnostic('bad-event', 'warning', {
          element: event.id,
          type: event.type,
        })
      );
    }
  }
}
