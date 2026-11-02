/**
 * Operations on the links network. Each operation is plain data; applying it
 * changes the model and returns:
 *
 * - `op`: the operation as applied, with every choice the store made filled
 *   in (the index of an append, the generated IDs of inserted anonymous
 *   elements), so applying `op` again on the same network gives the same
 *   result with the same IDs. The operation log records this form;
 * - `events`: the change events (without `seq`, `tx` and `origin`, which the
 *   store adds);
 * - `inverse`: the operation that undoes it exactly.
 *
 * An operation that throws has changed nothing: everything is checked before
 * the model is touched.
 *
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {import('@link-foundation/ui-core').UiNode} UiNode
 *
 * @typedef {{ op: 'insert', parentId: string|null, index: number, node: UiNode, ids: string[] }
 *   | { op: 'remove', id: string }
 *   | { op: 'move', id: string, parentId: string|null, index: number }
 *   | { op: 'setProp', id: string, name: string, values: RawValue[], index?: number }
 *   | { op: 'removeProp', id: string, name: string, index?: number }
 *   | { op: 'rename', id: string, to: string|null, as?: string }} Op
 *
 * `index`, `ids` and `as` are optional on input. `setProp` without `index`
 * replaces the values of the **last** property with that name (last wins,
 * docs/spec/ordering-and-ids.md) or appends one; with `index` it inserts a
 * new property at that position of the property list. `removeProp` without
 * `index` removes the last property with that name; with `index` it removes
 * the property at that position (which must have that name). `rename` with
 * `to: null` makes the element anonymous under the generated ID `as`.
 */

import { check } from './errors.js';
import {
  addSubtree,
  freezeValues,
  indexOf,
  isName,
  normalizeNode,
  preOrder,
  record,
  siblingsOf,
  snapshot,
  subtreeIds,
  toNode,
} from './model.js';

/** @typedef {import('./model.js').Model} Model */

const OPS = ['insert', 'remove', 'move', 'setProp', 'removeProp', 'rename'];

/**
 * @param {unknown} index
 * @param {number} max  the largest valid index
 */
function checkIndex(index, max) {
  check(
    Number.isInteger(index) && index >= 0 && index <= max,
    'bad-index',
    `Index ${index} is outside 0..${max}`
  );
}

const optionalIndex = (op) =>
  op.index === undefined ? {} : { index: op.index };

/** The event fields of an element as it is now. */
const place = (model, id) => {
  const node = record(model, id);
  return {
    id,
    parentId: node.parentId,
    index: indexOf(model, node),
    props: node.properties,
  };
};

/**
 * The IDs an inserted subtree gets: the given ones (a replay), else the
 * element id for named elements and a generated ID for anonymous ones.
 * @param {Model} model
 * @param {UiNode[]} nodes   the subtree in pre-order
 * @param {unknown} given
 */
function insertIds(model, nodes, given) {
  const named = nodes.filter((n) => n.id !== null).map((n) => n.id);
  const taken = (id) => model.nodes.has(id);
  for (const id of named) {
    check(!taken(id), 'duplicate-id', `The ID "${id}" is already used`);
  }
  check(
    new Set(named).size === named.length,
    'duplicate-id',
    'The inserted subtree uses an id twice'
  );
  if (given === undefined) {
    const inSubtree = new Set(named);
    const generate = () => {
      let id;
      do {
        id = model.ids.next();
      } while (inSubtree.has(id));
      return id;
    };
    return nodes.map((n) => n.id ?? generate());
  }
  check(
    Array.isArray(given) &&
      given.length === nodes.length &&
      new Set(given).size === given.length,
    'bad-op',
    'insert: `ids` must give one distinct ID per node, in pre-order'
  );
  nodes.forEach((n, i) => {
    check(
      isName(given[i]) && (n.id === null || n.id === given[i]),
      'bad-op',
      `insert: ID "${given[i]}" does not match node id "${n.id}"`
    );
    check(!taken(given[i]), 'duplicate-id', `The ID "${given[i]}" is used`);
  });
  nodes.forEach((n, i) => n.id === null && model.ids.reserve(given[i]));
  return given;
}

function insert(model, op) {
  const parentId = op.parentId ?? null;
  const list = siblingsOf(model, parentId);
  const index = op.index ?? list.length;
  checkIndex(index, list.length);
  const node = normalizeNode(op.node);
  const nodes = preOrder(node);
  const ids = Object.freeze([...insertIds(model, nodes, op.ids)]);
  addSubtree(model, node, ids, parentId, index);
  return {
    op: { op: 'insert', parentId, index, node, ids },
    events: ids.map((id) => ({
      type: 'insert',
      ...place(model, id),
      before: null,
      after: snapshot(model, id),
    })),
    inverse: { op: 'remove', id: ids[0] },
  };
}

function remove(model, op) {
  const { id } = op;
  const node = record(model, id);
  const parentId = node.parentId;
  const index = indexOf(model, node);
  const ids = Object.freeze(subtreeIds(model, id));
  const tree = toNode(model, id);
  // Children before parents, last children first: each event's index is
  // valid at the moment it is applied.
  const events = [...ids].reverse().map((each) => ({
    type: 'remove',
    ...place(model, each),
    props: null,
    before: snapshot(model, each),
    after: null,
  }));
  for (const each of ids) {
    model.nodes.delete(each);
    model.children.delete(each);
  }
  siblingsOf(model, parentId).splice(index, 1);
  return {
    op: { op: 'remove', id },
    events,
    inverse: {
      op: 'insert',
      parentId,
      index,
      node: tree,
      ids,
    },
  };
}

function move(model, op) {
  const { id } = op;
  const node = record(model, id);
  const parentId = op.parentId ?? null;
  const target = siblingsOf(model, parentId);
  for (let p = parentId; p !== null; p = model.nodes.get(p).parentId) {
    check(p !== id, 'cycle', `Cannot move "${id}" into itself`);
  }
  const from = { parentId: node.parentId, index: indexOf(model, node) };
  const max = target.length - (from.parentId === parentId ? 1 : 0);
  const index = op.index ?? max;
  checkIndex(index, max);
  siblingsOf(model, from.parentId).splice(from.index, 1);
  target.splice(index, 0, id);
  node.parentId = parentId;
  return {
    op: { op: 'move', id, parentId, index },
    events: [
      {
        type: 'move',
        ...place(model, id),
        before: Object.freeze(from),
        after: Object.freeze({ parentId, index }),
      },
    ],
    inverse: { op: 'move', id, ...from },
  };
}

const lastIndexOf = (properties, name) =>
  properties.findLastIndex((p) => p.name === name);

/** Replace the property list of a record and describe the change. */
function updated(model, node, properties, name, before, after) {
  node.properties = Object.freeze(properties);
  return [
    {
      type: 'update',
      ...place(model, node.id),
      prop: name,
      before,
      after,
    },
  ];
}

function setProp(model, op) {
  const { id, name } = op;
  const node = record(model, id);
  check(isName(name), 'bad-op', 'setProp: the name must be a string');
  const values = freezeValues(op.values);
  const property = Object.freeze({ name, values });
  const properties = [...node.properties];
  const replace = op.index === undefined ? lastIndexOf(properties, name) : -1;
  let inverse;
  let before = null;
  if (replace >= 0) {
    before = properties[replace].values;
    properties[replace] = property;
    inverse = { op: 'setProp', id, name, values: before };
  } else {
    const at = op.index ?? properties.length;
    checkIndex(at, properties.length);
    properties.splice(at, 0, property);
    inverse = { op: 'removeProp', id, name, index: at };
  }
  return {
    op: { op: 'setProp', id, name, values, ...optionalIndex(op) },
    events: updated(model, node, properties, name, before, values),
    inverse,
  };
}

function removeProp(model, op) {
  const { id, name } = op;
  const node = record(model, id);
  const properties = [...node.properties];
  const at = op.index ?? lastIndexOf(properties, name);
  check(
    Number.isInteger(at) && properties[at]?.name === name,
    'unknown-property',
    `Element "${id}" has no property "${name}"${op.index === undefined ? '' : ` at ${op.index}`}`
  );
  const [removed] = properties.splice(at, 1);
  return {
    op: { op: 'removeProp', id, name, ...optionalIndex(op) },
    events: updated(model, node, properties, name, removed.values, null),
    inverse: { op: 'setProp', id, name, values: removed.values, index: at },
  };
}

/** Give a record a new ID everywhere it is referenced. */
function rekey(model, node, to) {
  const from = node.id;
  const kids = model.children.get(from);
  const siblings = siblingsOf(model, node.parentId);
  siblings[siblings.indexOf(from)] = to;
  model.nodes.delete(from);
  model.children.delete(from);
  node.id = to;
  model.nodes.set(to, node);
  model.children.set(to, kids);
  for (const child of kids) {
    model.nodes.get(child).parentId = to;
  }
}

function rename(model, op) {
  const { id } = op;
  const node = record(model, id);
  const to = op.to ?? null;
  check(to === null || isName(to), 'bad-op', 'rename: `to` must be a string');
  check(
    op.as === undefined || (to === null && isName(op.as)),
    'bad-op',
    'rename: `as` is only for `to: null`'
  );
  const target = to ?? op.as;
  if (target !== undefined) {
    check(
      !model.nodes.has(target),
      'duplicate-id',
      `The ID "${target}" is already used`
    );
  }
  const newId = target ?? model.ids.next();
  if (to === null) {
    model.ids.reserve(newId);
  }
  const inverse = node.anonymous
    ? { op: 'rename', id: newId, to: null, as: id }
    : { op: 'rename', id: newId, to: id };
  rekey(model, node, newId);
  node.anonymous = to === null;
  return {
    op:
      to === null
        ? { op: 'rename', id, to, as: newId }
        : { op: 'rename', id, to },
    events: [
      { type: 'rename', ...place(model, newId), before: id, after: newId },
    ],
    inverse,
  };
}

const APPLY = { insert, remove, move, setProp, removeProp, rename };

/**
 * Apply one operation to a model.
 * @param {import('./model.js').Model} model
 * @param {Op} op
 * @returns {{ op: Op, events: object[], inverse: Op }}
 */
export function applyOp(model, op) {
  check(
    op !== null && typeof op === 'object' && OPS.includes(op.op),
    'bad-op',
    `Unknown operation ${JSON.stringify(op?.op)}; use ${OPS.join(', ')}`
  );
  if (op.op !== 'insert') {
    check(isName(op.id), 'bad-op', `${op.op}: \`id\` must be a string`);
  }
  const result = APPLY[op.op](model, op);
  return {
    op: Object.freeze(result.op),
    events: result.events.map((event) => Object.freeze(event)),
    inverse: Object.freeze(result.inverse),
  };
}
