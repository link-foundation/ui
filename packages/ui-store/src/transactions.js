/**
 * Transactions over a model: operations, their events, rollback on error,
 * the log, and undo/redo as new transactions.
 *
 * One transaction is open at a time; a nested `run` joins it and keeps a
 * savepoint, so an inner function that throws is undone alone. When the
 * outermost function returns, the transaction commits: it goes to the log
 * and the history, and its events go to the listeners. A transaction with
 * no operations commits nothing and uses no transaction number.
 */

import { check } from './errors.js';
import { applyOp } from './ops.js';

/** The origin of a transaction when none is given. */
export const DEFAULT_ORIGIN = 'user';

/** Transactions are synchronous: a promise would commit too early. */
function settle(result) {
  check(
    typeof result?.then !== 'function',
    'async-transaction',
    'A transaction function must be synchronous'
  );
  return result;
}

/**
 * @param {import('./model.js').Model} model
 * @param {ReturnType<import('./history.js').createHistory>} history
 * @param {(events: object[], entry: object) => void} emit
 */
export function createTransactions(model, history, emit) {
  /** Committed log entries, oldest first. */
  const entries = [];
  let lastTx = 0;
  let lastSeq = 0;
  /** The open transaction, or `null`. */
  let current = null;

  /** Apply one operation inside the open transaction. */
  function step(op) {
    const result = applyOp(model, op);
    current.ops.push(result.op);
    current.inverses.push(result.inverse);
    for (const event of result.events) {
      current.events.push(
        Object.freeze({
          seq: ++lastSeq,
          tx: current.tx,
          origin: current.origin,
          ...event,
        })
      );
    }
    return result.op;
  }

  /** Undo the operations after `mark` and forget them and their events. */
  function rollback(mark) {
    for (let i = current.inverses.length - 1; i >= mark.ops; i--) {
      applyOp(model, current.inverses[i]);
    }
    current.ops.length = mark.ops;
    current.inverses.length = mark.ops;
    current.events.length = mark.events;
    lastSeq = mark.seq;
  }

  const savepoint = () => ({
    ops: current.ops.length,
    events: current.events.length,
    seq: lastSeq,
  });

  /** @param {object} tx  the transaction that just ended */
  function commit(tx) {
    if (tx.ops.length === 0) {
      lastTx = tx.tx - 1;
      return;
    }
    const entry = Object.freeze({
      tx: tx.tx,
      origin: tx.origin,
      label: tx.label,
      ...tx.meta,
      ops: Object.freeze(tx.ops),
    });
    entries.push(entry);
    const item = Object.freeze({
      tx: tx.tx,
      ops: entry.ops,
      inverses: Object.freeze(tx.inverses),
    });
    if (tx.undoing) {
      history.undone(tx.undoing);
    } else if (tx.meta.redoes !== undefined) {
      history.redone(item);
    } else if (tx.origin !== 'links') {
      history.record(item);
    }
    emit(Object.freeze(tx.events), entry);
  }

  /**
   * Run `fn` as a transaction, or as part of the open one.
   * @param {string|null} label
   * @param {() => unknown} fn
   * @param {string} origin
   * @param {{ undoes?: number, redoes?: number }} [meta]  for undo and redo
   * @param {object} [undoing]  the history item an undo undoes
   */
  function run(label, fn, origin, meta = {}, undoing = null) {
    if (current) {
      const mark = savepoint();
      try {
        return settle(fn());
      } catch (error) {
        rollback(mark);
        throw error;
      }
    }
    current = { tx: ++lastTx, origin, label, meta, undoing };
    Object.assign(current, { ops: [], inverses: [], events: [] });
    const mark = savepoint();
    let result;
    try {
      result = settle(fn());
    } catch (error) {
      rollback(mark);
      current = null;
      lastTx -= 1;
      throw error;
    }
    const tx = current;
    current = null;
    commit(tx);
    return result;
  }

  /** Undo (`undo: true`) or redo the last transaction of the history. */
  function travel(undo) {
    check(
      !current,
      'in-transaction',
      'undo and redo cannot run inside a transaction'
    );
    const item = undo ? history.takeUndo() : history.takeRedo();
    if (!item) {
      return false;
    }
    const ops = undo ? [...item.inverses].reverse() : item.ops;
    try {
      run(
        null,
        () => ops.forEach(step),
        undo ? 'undo' : 'redo',
        undo ? { undoes: item.tx } : { redoes: item.tx },
        undo ? item : null
      );
    } catch (error) {
      (undo ? history.restoreUndo : history.restoreRedo)(item);
      throw error;
    }
    return true;
  }

  return {
    run,
    step,
    /** Apply one operation, as its own transaction outside `run`. */
    apply: (op) =>
      current ? step(op) : run(null, () => step(op), DEFAULT_ORIGIN),
    undo: () => travel(true),
    redo: () => travel(false),
    log: () => Object.freeze([...entries]),
  };
}
