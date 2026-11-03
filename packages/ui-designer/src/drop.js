/** Shared canvas/Outline drop rules use catalog child constraints. */
import { isLocked } from '@link-foundation/ui-devmode/model';
import { canContain } from './catalog.js';
import { property } from './geometry.js';

function targetNode(context, target) {
  const row = target?.closest?.('[role=treeitem]');
  if (row && context.outline.tree.contains(row)) {
    return {
      id: row.dataset.id,
      node: row.querySelector('.outline-row') ?? row,
      row: true,
    };
  }
  if (!context.canvas.contains(target)) {
    return null;
  }
  const id = context.handle.idFor(target);
  return id ? { id, node: context.handle.nodeFor(id), row: false } : null;
}

function isHorizontal(store, parent, row) {
  return (
    !row &&
    ['horizontal', 'row', 'row-reverse', 'grid'].includes(
      property(store, parent, 'direction') ?? store.get(parent)?.kind
    )
  );
}

/** Decide the stack/grid insert slot or container; centre drops on leaves refuse. */
export function dropTarget(context, target, x, y, types) {
  const hit = targetNode(context, target);
  if (!hit) {
    return null;
  }
  const { store, catalog, policy } = context;
  const { id, node, row } = hit;
  const rect = node.getBoundingClientRect();
  const parent = store.parentOf(id);
  const horizontal = isHorizontal(store, parent, row);
  const reverse =
    !row &&
    ['row-reverse', 'column-reverse'].includes(
      property(store, parent, 'direction')
    );
  const fraction = horizontal
    ? (x - rect.left) / rect.width
    : (y - rect.top) / rect.height;
  const edge = fraction < 0.25 ? 'before' : fraction > 0.75 ? 'after' : null;
  const accepts = (candidate) =>
    types.every((type) =>
      canContain(catalog, store.get(candidate)?.kind, type)
    );
  const around = edge && parent !== null && accepts(parent);
  const parentId = around ? parent : id;
  const valid = !!(
    (around || accepts(id)) &&
    !isLocked(policy, parentId, store.parentOf)
  );
  return {
    parentId,
    index: around
      ? store.indexOf(id) + ((edge === 'after') !== reverse ? 1 : 0)
      : store.children(id).length,
    valid,
    node,
    rect,
    horizontal,
    edge: around ? edge : null,
    free: !row && !around,
  };
}

export function ancestorOf(store, ancestor, id) {
  for (let at = store.parentOf(id); at !== null; at = store.parentOf(at)) {
    if (at === ancestor) {
      return true;
    }
  }
  return false;
}
