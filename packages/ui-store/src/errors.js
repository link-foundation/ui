/**
 * The error every store operation throws on bad input. `code` is one of:
 *
 * - `unknown-id`: no element has this ID;
 * - `duplicate-id`: the ID is already used by another element;
 * - `bad-index`: an index is out of range;
 * - `cycle`: an element cannot be moved into itself or its descendants;
 * - `unknown-property`: the element has no such property;
 * - `bad-op`, `bad-node`, `bad-value`: a malformed operation, node or value;
 * - `bad-log`: operation log text that is not in the log format;
 * - `in-transaction`: undo or redo called inside a transaction;
 * - `async-transaction`: a transaction function returned a promise.
 */
export class StoreError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

/**
 * Throw a {@link StoreError} unless `condition` holds.
 * @param {unknown} condition
 * @param {string} code
 * @param {string} message
 * @returns {asserts condition}
 */
export function check(condition, code, message) {
  if (!condition) {
    throw new StoreError(code, message);
  }
}
