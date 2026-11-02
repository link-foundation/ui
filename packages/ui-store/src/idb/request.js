/**
 * Small promise helpers over the raw IndexedDB API (no wrapper library).
 */

/**
 * The result of an `IDBRequest`.
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
export function request(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Resolves when `tx` commits; rejects when it fails or is aborted.
 * @param {IDBTransaction} tx
 * @returns {Promise<void>}
 */
export function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * Run `work(stores)` in one transaction over `names` and resolve with its
 * result when the transaction has committed. `work` must queue its requests
 * synchronously or only await IndexedDB requests of this transaction.
 * @template T
 * @param {IDBDatabase} db
 * @param {string[]} names
 * @param {IDBTransactionMode} mode
 * @param {(stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => T | Promise<T>} work
 * @returns {Promise<T>}
 */
export async function inTransaction(db, names, mode, work) {
  const tx = db.transaction(names, mode);
  const committed = done(tx);
  const stores = Object.fromEntries(names.map((n) => [n, tx.objectStore(n)]));
  let result;
  try {
    result = await work(stores, tx);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // already finished
    }
    committed.catch(() => {});
    throw error;
  }
  await committed;
  return result;
}

/**
 * Open a database. `upgrade(db, event)` runs on `upgradeneeded`.
 * @param {IDBFactory} factory
 * @param {string} name
 * @param {number} version
 * @param {(db: IDBDatabase, event: IDBVersionChangeEvent) => void} upgrade
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase(factory, name, version, upgrade) {
  const open = factory.open(name, version);
  open.onupgradeneeded = (event) => upgrade(open.result, event);
  return request(open);
}

/**
 * Delete a database. Rejects when it stays blocked by an open connection.
 * @param {IDBFactory} factory
 * @param {string} name
 * @returns {Promise<void>}
 */
export function deleteDatabase(factory, name) {
  const deletion = factory.deleteDatabase(name);
  return new Promise((resolve, reject) => {
    deletion.onsuccess = () => resolve();
    deletion.onerror = () => reject(deletion.error);
    deletion.onblocked = () =>
      reject(new Error(`Database ${name} is open in another connection`));
  });
}
