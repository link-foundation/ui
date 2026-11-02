/**
 * Helpers of the persistence tests: a fresh in-memory IndexedDB
 * (`fake-indexeddb`) per test and raw reads of its object stores.
 */

import { IDBFactory } from 'fake-indexeddb';
import { openPersistentStore } from '@link-foundation/ui-store';
import { randomOp, seededRandom } from './helpers.js';

export const TEXT =
  "(ok: button (label 'OK'))\n(stack (text a) (text b (variant x)))\n";

/** A new, empty IndexedDB factory. */
export const freshIndexedDB = () => new IDBFactory();

/**
 * Open a persistent store without the BroadcastChannel (unless asked).
 * @param {IDBFactory} indexedDB
 * @param {object} [options]
 */
export const open = (indexedDB, options = {}) =>
  openPersistentStore({
    name: 'demo',
    indexedDB,
    initialText: TEXT,
    channel: false,
    ...options,
  });

/** Every row of one object store of `link-ui-<name>`, read directly. */
export function rows(indexedDB, name, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`link-ui-${name}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const all = db
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .getAll();
      all.onerror = () => reject(all.error);
      all.onsuccess = () => {
        db.close();
        resolve(all.result);
      };
    };
  });
}

/**
 * `count` seeded random edits (with some undo and redo) through the public
 * API; returns how many transactions were committed.
 */
export function seededEdits(store, seed, count) {
  const rand = seededRandom(seed);
  const before = store.log().length;
  for (let n = 0; n < count; n++) {
    const roll = rand();
    if (roll < 0.1) {
      store.undo();
    } else if (roll < 0.15) {
      store.redo();
    } else {
      randomOp(store, rand, n);
    }
  }
  return store.log().length - before;
}

/** Resolves on the next `onReload` of `persistence`. */
export const nextReload = (persistence) =>
  new Promise((resolve) => {
    const stop = persistence.onReload(() => {
      stop();
      resolve();
    });
  });
