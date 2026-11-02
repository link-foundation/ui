/**
 * The edit operations of the store (link-foundation/ui#16) applied to a parsed tree. This is the
 * reference the source edits are checked against: after an edit of the text,
 * `parse(newText)` must deep-equal `applyOpToTree(parse(oldText), op)`.
 *
 * Ops:
 *   { op: 'insert', parentId, index, node }   parentId null: a root
 *   { op: 'remove', id }
 *   { op: 'move', id, parentId, index }
 *   { op: 'setProp', id, name, values }       the last prop with that name
 *                                             wins, otherwise one is appended
 *   { op: 'removeProp', id, name }
 *   { op: 'rename', id, to }                  the definition only
 *   { op: 'setPositional', id, values }
 *
 * `index` counts child elements; it may equal the number of children.
 */

/** @typedef {import('../types.js').UiNode} UiNode */

/**
 * @typedef {{ roots: UiNode[], unknown: import('../types.js').RawValue[] }} Tree
 */

/** A deep copy of the comparable part of a document. */
export const cloneTree = (doc) =>
  JSON.parse(JSON.stringify({ roots: doc.roots, unknown: doc.unknown }));

/** Whether two documents have the same elements and unknown links. */
export const sameTree = (a, b) =>
  JSON.stringify({ roots: a.roots, unknown: a.unknown }) ===
  JSON.stringify({ roots: b.roots, unknown: b.unknown });

/**
 * The first element with `id`, in document order, with the list it is in.
 * @param {UiNode[]} nodes
 * @param {string} id
 * @returns {{ node: UiNode, list: UiNode[], index: number } | null}
 */
export function findNode(nodes, id) {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.id === id) {
      return { node, list: nodes, index };
    }
    const found = findNode(node.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Every element of a list of trees, in document order. */
function* allNodes(nodes) {
  for (const node of nodes) {
    yield node;
    yield* allNodes(node.children);
  }
}

class OpError extends Error {}

function need(condition, message) {
  if (!condition) {
    throw new OpError(message);
  }
}

function element(tree, id) {
  need(typeof id === 'string', 'The op has no element id');
  const found = findNode(tree.roots, id);
  need(found, `No element "${id}"`);
  return found;
}

function childList(tree, parentId) {
  if (parentId === null || parentId === undefined) {
    return tree.roots;
  }
  return element(tree, parentId).node.children;
}

function checkIndex(list, index) {
  need(
    Number.isInteger(index) && index >= 0 && index <= list.length,
    `Index ${index} is out of range 0..${list.length}`
  );
}

const isValues = (values) => Array.isArray(values);

const OPS = {
  insert(tree, { parentId, index, node }) {
    need(node && typeof node === 'object', 'The insert op has no node');
    const list = childList(tree, parentId);
    checkIndex(list, index);
    list.splice(index, 0, JSON.parse(JSON.stringify(node)));
  },
  remove(tree, { id }) {
    const { list, index } = element(tree, id);
    list.splice(index, 1);
  },
  move(tree, { id, parentId, index }) {
    const { node, list, index: from } = element(tree, id);
    if (parentId !== null && parentId !== undefined) {
      need(
        !findNode([node], parentId),
        `Cannot move "${id}" into itself or its descendant`
      );
    }
    list.splice(from, 1);
    const target = childList(tree, parentId);
    checkIndex(target, index);
    target.splice(index, 0, node);
  },
  setProp(tree, { id, name, values }) {
    need(typeof name === 'string', 'The setProp op has no name');
    need(isValues(values), 'The setProp op has no values');
    const { node } = element(tree, id);
    const copy = JSON.parse(JSON.stringify(values));
    const last = node.properties.findLastIndex((p) => p.name === name);
    if (last === -1) {
      node.properties.push({ name, values: copy });
    } else {
      node.properties[last].values = copy;
    }
  },
  removeProp(tree, { id, name }) {
    const { node } = element(tree, id);
    need(
      node.properties.some((p) => p.name === name),
      `Element "${id}" has no property "${name}"`
    );
    node.properties = node.properties.filter((p) => p.name !== name);
  },
  rename(tree, { id, to }) {
    need(typeof to === 'string' && to !== '', 'The rename op has no new id');
    const { node } = element(tree, id);
    if (to !== id) {
      need(
        ![...allNodes(tree.roots)].some((n) => n.id === to),
        `The id "${to}" is already used`
      );
    }
    node.id = to;
  },
  setPositional(tree, { id, values }) {
    need(isValues(values), 'The setPositional op has no values');
    need(
      values.every((v) => typeof v === 'string'),
      'Positional values are references (strings)'
    );
    const { node } = element(tree, id);
    need(node.kind !== null, `Element "${id}" has no kind`);
    node.positional = [...values];
  },
};

/** The op names this module knows. */
export const OP_NAMES = Object.keys(OPS);

/**
 * Apply one op to a copy of a document tree.
 * @param {Tree} doc
 * @param {object} op
 * @returns {{ ok: true, tree: Tree } | { ok: false, error: string }}
 */
export function applyOpToTree(doc, op) {
  const apply = OPS[op?.op];
  if (!apply) {
    return { ok: false, error: `Unknown op "${op?.op}"` };
  }
  const tree = cloneTree(doc);
  try {
    apply(tree, op);
  } catch (error) {
    if (error instanceof OpError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
  return { ok: true, tree };
}
