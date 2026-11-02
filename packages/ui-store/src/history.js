/**
 * Undo and redo stacks (the command pattern of ProseMirror history and the
 * Yjs `UndoManager`, as ideas only).
 *
 * Every item is one committed transaction: its operations as applied and
 * their inverses in the same order. Undo applies the inverses in reverse
 * order as a **new** transaction (`origin: 'undo'`), so the operation log
 * stays append-only; redo applies the operations again (`origin: 'redo'`).
 *
 * @typedef {import('./ops.js').Op} Op
 * @typedef {{ tx: number, ops: readonly Op[], inverses: readonly Op[] }} HistoryItem
 */

/** The default number of undoable transactions a store keeps. */
export const DEFAULT_HISTORY_LIMIT = 500;

/**
 * @param {number} [limit]  at most this many transactions can be undone
 */
export function createHistory(limit = DEFAULT_HISTORY_LIMIT) {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError(`historyLimit must be a non-negative integer`);
  }
  /** @type {HistoryItem[]} */
  const undoStack = [];
  /** @type {HistoryItem[]} */
  const redoStack = [];
  const push = (item) => {
    undoStack.push(item);
    if (undoStack.length > limit) {
      undoStack.shift();
    }
  };
  return {
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    /**
     * A transaction committed by the user (not by undo or redo): it can be
     * undone, and nothing can be redone any more.
     * @param {HistoryItem} item
     */
    record(item) {
      push(item);
      redoStack.length = 0;
    },
    /** @returns {HistoryItem|undefined} */
    takeUndo: () => undoStack.pop(),
    /** @returns {HistoryItem|undefined} */
    takeRedo: () => redoStack.pop(),
    /**
     * After an undo: `item` (the undone transaction) can be redone.
     * @param {HistoryItem} item
     */
    undone(item) {
      redoStack.push(item);
    },
    /**
     * After a redo: the new transaction can be undone again; the redo stack
     * keeps the rest.
     * @param {HistoryItem} item
     */
    redone(item) {
      push(item);
    },
    /** Put an item back where it was taken from (its transaction failed). */
    restoreUndo: (item) => undoStack.push(item),
    restoreRedo: (item) => redoStack.push(item),
  };
}
