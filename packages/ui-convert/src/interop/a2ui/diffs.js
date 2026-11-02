/**
 * A2UI messages -> incremental document diffs.
 *
 * After each message the client state is turned into an element tree (see
 * build.js) and compared with the tree before it. The difference is a list
 * of diffs, applied in order:
 *
 *   { op: 'remove', id }                       remove an element and its subtree
 *   { op: 'insert', id, parent?, index, kind, props }
 *                                               add an element (no parent: a root)
 *   { op: 'set', id, props }                   replace the values of an element
 *
 * `props` is `{ positional, properties }` of a ui-core node. `index` (the
 * position among the siblings) extends the shape in the issue so that an
 * insert lands exactly where the tree has it. An element that changes its
 * parent, its kind or its order among its siblings is removed and inserted
 * again.
 */

import { Diagnostics } from '../../diagnostics.js';
import { element } from '../lino.js';
import { TreeBuilder } from './build.js';
import { FORMAT, readMessages } from './shared.js';
import { StateFolder } from './state.js';

/**
 * @typedef {import('@link-foundation/ui-core').UiNode} UiNode
 * @typedef {{ positional: string[], properties: object[] }} DiffProps
 * @typedef {{ op: 'insert'|'set'|'remove', id: string, parent?: string,
 *   index?: number, kind?: string, props?: DiffProps }} Diff
 */

const copy = (value) => JSON.parse(JSON.stringify(value));

/** @param {UiNode} node @returns {DiffProps} */
const propsOf = (node) =>
  copy({ positional: node.positional, properties: node.properties });

/** Every element of a tree by id, with its parent id and position. */
function indexTree(roots) {
  const index = new Map();
  const walk = (nodes, parent) =>
    nodes.forEach((node, pos) => {
      index.set(node.id, { node, parent, pos });
      walk(node.children, node.id);
    });
  walk(roots, null);
  return index;
}

/**
 * The diffs that turn the tree `before` into the tree `after`. Elements are
 * matched by id.
 * @param {UiNode[]} before
 * @param {UiNode[]} after
 * @returns {Diff[]}
 */
export function diffTrees(before, after) {
  const old = indexTree(before);
  const kept = new Set();
  const match = (nodes, parent) => {
    let last = -1;
    for (const node of nodes) {
      const was = old.get(node.id);
      if (
        was &&
        was.parent === parent &&
        was.node.kind === node.kind &&
        (parent === null || kept.has(parent)) &&
        was.pos > last
      ) {
        kept.add(node.id);
        last = was.pos;
      }
    }
    nodes.forEach((node) => match(node.children, node.id));
  };
  match(after, null);
  const diffs = [];
  const removed = (nodes) =>
    nodes.forEach((node) =>
      kept.has(node.id)
        ? removed(node.children)
        : diffs.push({ op: 'remove', id: node.id })
    );
  removed(before);
  const added = (nodes, parent) =>
    nodes.forEach((node, index) => {
      if (!kept.has(node.id)) {
        diffs.push({
          op: 'insert',
          id: node.id,
          ...(parent === null ? {} : { parent }),
          index,
          kind: node.kind,
          props: propsOf(node),
        });
      } else if (
        JSON.stringify(propsOf(node)) !==
        JSON.stringify(propsOf(old.get(node.id).node))
      ) {
        diffs.push({ op: 'set', id: node.id, props: propsOf(node) });
      }
      added(node.children, node.id);
    });
  added(after, null);
  return diffs;
}

/**
 * Apply diffs to a copy of an element tree.
 * @param {UiNode[]} roots
 * @param {Diff[]} diffs
 * @returns {UiNode[]} The new roots; `roots` is not changed.
 * @throws {Error} When a diff names an element the tree does not have.
 */
export function applyA2uiDiffs(roots, diffs) {
  const out = copy(roots);
  const find = (id) => {
    const found = indexTree(out).get(id);
    if (!found) {
      throw new Error(`a2ui diff: no element "${id}"`);
    }
    return found;
  };
  const siblings = (parent) =>
    parent === null ? out : find(parent).node.children;
  for (const diff of diffs) {
    if (diff.op === 'remove') {
      const { parent, pos } = find(diff.id);
      siblings(parent).splice(pos, 1);
    } else if (diff.op === 'insert') {
      const list = siblings(diff.parent ?? null);
      const node = element(diff.id, diff.kind, copy(diff.props));
      list.splice(diff.index ?? list.length, 0, node);
    } else if (diff.op === 'set') {
      Object.assign(find(diff.id).node, copy(diff.props));
    } else {
      throw new Error(`a2ui diff: unknown op "${diff.op}"`);
    }
  }
  return out;
}

/**
 * An incremental converter: push A2UI messages one at a time and get the
 * diffs each one makes.
 */
export class A2uiStream {
  constructor() {
    this.diagnostics = new Diagnostics(FORMAT);
    this.folder = new StateFolder(this.diagnostics);
    /** @type {UiNode[]} */
    this.tree = [];
    /** The diagnostics of the latest tree build. */
    this.buildDiagnostics = [];
    this.count = 0;
  }

  /**
   * Fold one message and return the diffs it makes.
   * @param {unknown} message
   * @returns {{ diffs: Diff[],
   *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
   */
  push(message) {
    const before = this.diagnostics.list.length;
    this.folder.fold(message, `/${this.count}`);
    this.count += 1;
    const build = new Diagnostics(FORMAT);
    const tree = new TreeBuilder(build).build(this.folder.state);
    const diffs = diffTrees(this.tree, tree);
    this.tree = tree;
    this.buildDiagnostics = build.list;
    return {
      diffs,
      diagnostics: [...this.diagnostics.list.slice(before), ...build.list],
    };
  }

  /** The diagnostics of every message so far and of the current tree. */
  allDiagnostics() {
    return [...this.diagnostics.list, ...this.buildDiagnostics];
  }
}

/**
 * Turn A2UI messages into incremental document diffs.
 * @param {object[]|{ messages: object[] }|string} messages A2UI protocol
 *   messages in stream order (an array, a `{ messages }` sample or JSON
 *   Lines text).
 * @returns {{ diffs: Diff[],
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function a2uiMessagesToDiffs(messages) {
  const stream = new A2uiStream();
  let list;
  try {
    list = readMessages(messages);
  } catch {
    list = null;
  }
  if (list === null) {
    stream.diagnostics.error(
      'not-a2ui',
      'The input is not a list of A2UI messages.',
      { path: '' }
    );
    return { diffs: [], diagnostics: stream.allDiagnostics() };
  }
  const diffs = list.flatMap((message) => stream.push(message).diffs);
  return { diffs, diagnostics: stream.allDiagnostics() };
}
