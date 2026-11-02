/**
 * @link-foundation/ui-store: a UI document as a mutable links network with
 * stable IDs, change events, transactions, undo/redo and an operation log.
 */

export { createStore, DEFAULT_ORIGIN } from './store.js';
export { StoreError } from './errors.js';
export { createIdGenerator, GENERATED_ID_PREFIX } from './ids.js';
export { DEFAULT_HISTORY_LIMIT } from './history.js';
export { logToLino, logFromLino } from './log-lino.js';
