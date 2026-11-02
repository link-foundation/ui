/**
 * @link-foundation/ui-store: a UI document as a mutable links network with
 * stable IDs, change events, transactions, undo/redo and an operation log.
 */

export { createStore, DEFAULT_ORIGIN } from './store.js';
export { StoreError } from './errors.js';
export { createIdGenerator, GENERATED_ID_PREFIX } from './ids.js';
export { DEFAULT_HISTORY_LIMIT } from './history.js';
export { logToLino, logFromLino } from './log-lino.js';
export { openPersistentStore } from './persistent.js';
export {
  encodeDocument,
  decodeDocument,
  NIL_POINTS,
} from './doublets/encode.js';
export { copyToDoubletsWeb, openDoubletsWeb } from './doublets/web-adapter.js';
export { DEFAULT_BUNDLE_LIMITS, BUNDLE_HEAD } from './bundle.js';
export { SCHEMA_VERSION, DATABASE_PREFIX, databaseName } from './idb/schema.js';
