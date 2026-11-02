/**
 * The IndexedDB schema of a persistent store: database `link-ui-<name>`,
 * version 1.
 *
 * | Object store | keyPath      | Indexes                               | Content                                |
 * | ------------ | ------------ | ------------------------------------- | -------------------------------------- |
 * | `links`      | `index`      | `source`, `target`, `[source+target]` | doublets triples                       |
 * | `names`      | `name`       | `index` (unique)                      | reference string → point               |
 * | `log`        | `seq` (auto) | `tx`                                  | `{ seq, tx, lino }` entries            |
 * | `meta`       | `key`        | —                                     | `schemaVersion`, `roots`, `snapshotTx` |
 */

/** The version of the database and of the bundle format. */
export const SCHEMA_VERSION = 1;

/** The prefix of the database (and BroadcastChannel) name. */
export const DATABASE_PREFIX = 'link-ui-';

/** Every object store, in the order of the table above. */
export const STORES = Object.freeze(['links', 'names', 'log', 'meta']);

/** @param {string} name */
export const databaseName = (name) => `${DATABASE_PREFIX}${name}`;

/**
 * Create the object stores of version 1 (the `upgradeneeded` handler).
 * @param {IDBDatabase} db
 * @param {IDBVersionChangeEvent} event
 */
export function upgrade(db, event) {
  if (event.oldVersion < 1) {
    const links = db.createObjectStore('links', { keyPath: 'index' });
    links.createIndex('source', 'source');
    links.createIndex('target', 'target');
    links.createIndex('source+target', ['source', 'target']);
    const names = db.createObjectStore('names', { keyPath: 'name' });
    names.createIndex('index', 'index', { unique: true });
    const log = db.createObjectStore('log', {
      keyPath: 'seq',
      autoIncrement: true,
    });
    log.createIndex('tx', 'tx');
    db.createObjectStore('meta', { keyPath: 'key' });
  }
}
