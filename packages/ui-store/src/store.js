/**
 * `createStore(options)`: a UI document as a mutable links network with
 * stable IDs, change events, nested transactions, undo/redo and an ordered
 * operation log (see README.md).
 */

import { format, parseOrThrow } from '@link-foundation/ui-core';
import { check } from './errors.js';
import { createEmitter } from './emitter.js';
import { createHistory } from './history.js';
import {
  createModel,
  record,
  siblingsOf,
  snapshot,
  toDocument,
} from './model.js';
import { createTransactions, DEFAULT_ORIGIN } from './transactions.js';

export { DEFAULT_ORIGIN };

/**
 * @param {object} [options]
 * @param {{ roots?: object[], unknown?: unknown[] }} [options.document]
 * @param {string} [options.text]           LiNo, read with ui-core `parseOrThrow`
 * @param {object} [options.parseOptions]   options of `parseOrThrow`
 * @param {string[]} [options.ids]  the store IDs of every element in
 *   pre-order (default: an anonymous element gets a generated ID)
 * @param {number} [options.historyLimit]   default 500
 * @param {(error: unknown, info: object) => void} [options.onListenerError]
 */
export function createStore(options = {}) {
  const { document, text, ids, historyLimit, onListenerError, parseOptions } =
    options;
  const source =
    document ?? (text === undefined ? {} : parseOrThrow(text, parseOptions));
  const model = createModel(source, ids);
  const emitter = createEmitter(onListenerError);
  const history = createHistory(historyLimit);
  const txs = createTransactions(model, history, emitter.emit);
  const { apply } = txs;

  const store = {
    /** The frozen view of an element, or `undefined`. */
    get: (id) => (model.nodes.has(id) ? snapshot(model, id) : undefined),
    has: (id) => model.nodes.has(id),
    /** The IDs of the root elements, in order. */
    roots: () => Object.freeze([...model.roots]),
    /** The IDs of the children of an element, in order. */
    children: (id) => Object.freeze([...siblingsOf(model, id)]),
    /** The ID of the parent of an element; `null` for a root. */
    parentOf: (id) => record(model, id).parentId,
    /** The position of an element among its siblings. */
    indexOf: (id) => siblingsOf(model, record(model, id).parentId).indexOf(id),

    /** Insert a subtree; returns the ID of its root element. */
    insert: (parentId, index, node) =>
      apply({ op: 'insert', parentId, index, node }).ids[0],
    remove: (id) => {
      apply({ op: 'remove', id });
    },
    move: (id, parentId, index) => {
      apply({ op: 'move', id, parentId, index });
    },
    setProp: (id, name, values) => {
      apply({ op: 'setProp', id, name, values });
    },
    removeProp: (id, name) => {
      apply({ op: 'removeProp', id, name });
    },
    /** Give an element a new ID; returns it. */
    rename: (id, to) => {
      const op = apply({ op: 'rename', id, to });
      return op.to ?? op.as;
    },
    /** Apply an operation given as data; returns it as applied. */
    apply,

    /**
     * Run `fn` as one transaction: listeners get all its events in one
     * call. Nested calls join the outer transaction. If `fn` throws, its
     * changes are rolled back, nothing is emitted, and the error is thrown
     * again.
     */
    transaction(label, fn, opts = {}) {
      if (typeof label === 'function') {
        return store.transaction(null, label, fn ?? {});
      }
      check(typeof fn === 'function', 'bad-op', 'transaction needs a function');
      const origin = opts.origin ?? DEFAULT_ORIGIN;
      check(typeof origin === 'string', 'bad-op', 'origin must be a string');
      return txs.run(label ?? null, fn, origin);
    },

    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    /** Undo the last transaction; `false` when there is nothing to undo. */
    undo: txs.undo,
    /** Redo the last undone transaction; `false` when there is none. */
    redo: txs.redo,

    /** Call `listener(events, entry)` after every committed transaction. */
    subscribe: emitter.subscribe,

    /** Every committed transaction, oldest first. */
    log: txs.log,
    /**
     * Apply log entries (from `log()` or `logFromLino`) as new
     * transactions, keeping their origin and label.
     */
    replay(logEntries) {
      for (const entry of logEntries) {
        txs.run(
          entry.label ?? null,
          () => entry.ops.forEach(txs.step),
          entry.origin ?? DEFAULT_ORIGIN
        );
      }
    },

    toDocument: () => toDocument(model),
    toLino: (formatOptions) => format(toDocument(model), formatOptions),
  };
  return Object.freeze(store);
}
