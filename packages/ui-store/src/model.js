/**
 * The links network a store holds: every element is a record in `nodes`,
 * keyed by its stable ID, and the order of children is kept in `children`.
 *
 * Every value array a record holds (`positional`, `properties`, `unknown`)
 * is deeply frozen and replaced, never changed in place, so reads can share
 * it. Records themselves stay private to the store; reads get frozen
 * snapshots.
 */

import { SPEC_VERSION } from '@link-foundation/ui-core';
import { check } from './errors.js';
import { createIdGenerator } from './ids.js';

/**
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {import('@link-foundation/ui-core').UiNode} UiNode
 * @typedef {import('@link-foundation/ui-core').UiProperty} UiProperty
 *
 * @typedef {object} NodeRecord
 * @property {string} id                  the stable store ID
 * @property {boolean} anonymous          `true`: the document has no id for it
 * @property {string|null} kind
 * @property {readonly RawValue[]} positional
 * @property {readonly UiProperty[]} properties
 * @property {readonly RawValue[]} unknown
 * @property {string|null} parentId       `null` for a root element
 *
 * @typedef {object} Model
 * @property {Map<string, NodeRecord>} nodes
 * @property {Map<string, string[]>} children
 * @property {string[]} roots
 * @property {readonly RawValue[]} unknown  top-level links that are not elements
 * @property {ReturnType<typeof createIdGenerator>} ids
 */

/**
 * A deeply frozen copy of a value (docs/spec/values.md).
 * @param {unknown} value
 * @returns {RawValue}
 */
export function freezeValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeValue));
  }
  check(
    value !== null &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      Array.isArray(value.values),
    'bad-value',
    `Not a value: ${JSON.stringify(value)}`
  );
  return Object.freeze({ id: value.id, values: freezeValues(value.values) });
}

/**
 * @param {unknown} values
 * @returns {readonly RawValue[]}
 */
export function freezeValues(values) {
  check(Array.isArray(values), 'bad-value', 'Values must be an array');
  return Object.freeze(values.map(freezeValue));
}

/**
 * @param {unknown} property
 * @returns {Readonly<UiProperty>}
 */
export function freezeProperty(property) {
  check(
    property !== null && typeof property === 'object' && isName(property.name),
    'bad-node',
    'A property needs a non-empty string name'
  );
  return Object.freeze({
    name: property.name,
    values: freezeValues(property.values),
  });
}

/** @param {unknown} name */
export const isName = (name) => typeof name === 'string' && name.length > 0;

/**
 * A deeply frozen, complete copy of a hand-written or parsed node: missing
 * arrays become empty, so `{ id: null, kind: 'text' }` is a valid node.
 * @param {unknown} node
 * @returns {Readonly<UiNode>}
 */
export function normalizeNode(node) {
  check(
    node !== null && typeof node === 'object',
    'bad-node',
    'A node must be an object'
  );
  const id = node.id ?? null;
  const kind = node.kind ?? null;
  check(id === null || isName(id), 'bad-node', 'A node id must be a string');
  check(kind === null || isName(kind), 'bad-node', 'A kind must be a string');
  const unknown = freezeValues(node.unknown ?? []);
  check(
    kind !== null || unknown.length > 0,
    'bad-node',
    'A node without a kind needs its first value in `unknown`'
  );
  const children = node.children ?? [];
  check(Array.isArray(children), 'bad-node', 'children must be an array');
  const properties = node.properties ?? [];
  check(Array.isArray(properties), 'bad-node', 'properties must be an array');
  return Object.freeze({
    id,
    kind,
    positional: freezeValues(node.positional ?? []),
    properties: Object.freeze(properties.map(freezeProperty)),
    children: Object.freeze(children.map(normalizeNode)),
    unknown,
  });
}

/**
 * The nodes of a subtree in pre-order (parents first, children in order).
 * @param {UiNode} node
 * @returns {UiNode[]}
 */
export function preOrder(node) {
  return [node, ...node.children.flatMap(preOrder)];
}

/**
 * The children list of `parentId` (`null`: the roots).
 * @param {Model} model
 * @param {string|null} parentId
 * @returns {string[]}
 */
export function siblingsOf(model, parentId) {
  if (parentId === null) {
    return model.roots;
  }
  const list = model.children.get(parentId);
  check(list, 'unknown-id', `No element with ID "${parentId}"`);
  return list;
}

/**
 * @param {Model} model
 * @param {string} id
 * @returns {NodeRecord}
 */
export function record(model, id) {
  const node = model.nodes.get(id);
  check(node, 'unknown-id', `No element with ID "${id}"`);
  return node;
}

/**
 * The position of an element among its siblings.
 * @param {Model} model
 * @param {NodeRecord} node
 */
export const indexOf = (model, node) =>
  siblingsOf(model, node.parentId).indexOf(node.id);

/**
 * Add the records of a normalized subtree under `parentId` at `index`. The
 * caller has checked the IDs (`ids`, one per node in pre-order).
 * @param {Model} model
 * @param {UiNode} node
 * @param {string[]} ids
 * @param {string|null} parentId
 * @param {number} index
 */
export function addSubtree(model, node, ids, parentId, index) {
  let next = 0;
  const add = (current, parent) => {
    const id = ids[next++];
    model.nodes.set(id, {
      id,
      anonymous: current.id === null,
      kind: current.kind,
      positional: current.positional,
      properties: current.properties,
      unknown: current.unknown,
      parentId: parent,
    });
    model.children.set(id, []);
    for (const child of current.children) {
      model.children.get(id).push(add(child, id));
    }
    return id;
  };
  siblingsOf(model, parentId).splice(index, 0, add(node, parentId));
}

/**
 * The IDs of a subtree in pre-order.
 * @param {Model} model
 * @param {string} id
 * @returns {string[]}
 */
export function subtreeIds(model, id) {
  return [id, ...model.children.get(id).flatMap((c) => subtreeIds(model, c))];
}

/**
 * A subtree as a deeply frozen `UiNode` (anonymous elements get `id: null`).
 * @param {Model} model
 * @param {string} id
 * @returns {Readonly<UiNode>}
 */
export function toNode(model, id) {
  const node = model.nodes.get(id);
  return Object.freeze({
    id: node.anonymous ? null : node.id,
    kind: node.kind,
    positional: node.positional,
    properties: node.properties,
    children: Object.freeze(
      model.children.get(id).map((child) => toNode(model, child))
    ),
    unknown: node.unknown,
  });
}

/**
 * The frozen public view of one element (without its children; see
 * `store.children(id)`).
 * @param {Model} model
 * @param {string} id
 */
export function snapshot(model, id) {
  const node = record(model, id);
  return Object.freeze({
    id: node.id,
    name: node.anonymous ? null : node.id,
    kind: node.kind,
    positional: node.positional,
    properties: node.properties,
    unknown: node.unknown,
    parentId: node.parentId,
  });
}

/**
 * Build a model from a UI document (or `{ roots, unknown }`). Named elements
 * keep their id; anonymous elements get generated IDs in document order,
 * or the IDs of `ids` (the store IDs of every element in pre-order, as the
 * `ids` of an insert operation) when it is given.
 * @param {{ roots?: UiNode[], unknown?: RawValue[] }} document
 * @param {string[]} [ids]
 * @returns {Model}
 */
export function createModel(document = {}, ids = undefined) {
  const roots = (document.roots ?? []).map(normalizeNode);
  /** @type {Model} */
  const model = {
    nodes: new Map(),
    children: new Map(),
    roots: [],
    unknown: freezeValues(document.unknown ?? []),
    ids: null,
  };
  const named = new Set();
  for (const node of roots.flatMap(preOrder)) {
    if (node.id !== null) {
      check(
        !named.has(node.id),
        'duplicate-id',
        `The document uses the id "${node.id}" twice`
      );
      named.add(node.id);
    }
  }
  model.ids = createIdGenerator((id) => named.has(id) || model.nodes.has(id));
  const given = ids === undefined ? undefined : givenIds(model, roots, ids);
  let next = 0;
  for (const node of roots) {
    const nodes = preOrder(node);
    const subtree = given
      ? given.slice(next, next + nodes.length)
      : nodes.map((n) => n.id ?? model.ids.next());
    next += nodes.length;
    addSubtree(model, node, subtree, null, model.roots.length);
  }
  return model;
}

/**
 * Check the `ids` option of `createModel` and reserve its IDs of anonymous
 * elements.
 * @param {Model} model
 * @param {UiNode[]} roots
 * @param {unknown} ids
 * @returns {string[]}
 */
function givenIds(model, roots, ids) {
  const nodes = roots.flatMap(preOrder);
  check(
    Array.isArray(ids) &&
      ids.length === nodes.length &&
      new Set(ids).size === ids.length,
    'bad-op',
    '`ids` must give one distinct ID per element, in pre-order'
  );
  const named = new Set(nodes.map((n) => n.id).filter((id) => id !== null));
  nodes.forEach((node, i) => {
    check(
      isName(ids[i]) &&
        (node.id === null ? !named.has(ids[i]) : node.id === ids[i]),
      'bad-op',
      `ID "${ids[i]}" does not match element id "${node.id}"`
    );
    if (node.id === null) {
      model.ids.reserve(ids[i]);
    }
  });
  return ids;
}

/**
 * The current network as a `UiDocument` of `@link-foundation/ui-core`.
 * The store does not validate, so `diagnostics` is empty.
 * @param {Model} model
 */
export function toDocument(model) {
  const roots = Object.freeze(model.roots.map((id) => toNode(model, id)));
  const byId = new Map();
  for (const node of roots.flatMap(preOrder)) {
    if (node.id !== null) {
      byId.set(node.id, node);
    }
  }
  return Object.freeze({
    spec: SPEC_VERSION,
    roots,
    unknown: model.unknown,
    byId,
    diagnostics: Object.freeze([]),
  });
}
