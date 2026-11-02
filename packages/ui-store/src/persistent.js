/**
 * `openPersistentStore(options)`: a store saved to IndexedDB as a doublets
 * table plus an operation log (see README.md, "Persistence").
 *
 * - The **snapshot** is the document at transaction `snapshotTx`, encoded
 *   with `encodeDocument` into the `links` and `names` object stores; its
 *   `roots`, the store IDs of its elements (`ids`) and `snapshotTx` are in
 *   `meta`.
 * - Every committed transaction is appended to `log` as `{ seq, tx, lino }`
 *   (the `logToLino` text of that transaction) in one `readwrite`
 *   transaction (write-through).
 * - Loading decodes the snapshot and replays the `log` entries with
 *   `tx > snapshotTx`.
 *
 * Tabs: after each write a `BroadcastChannel('link-ui-<name>')` message
 * `{ tx }` tells the other tabs to `reload()`. There is no conflict
 * resolution: the last writer wins.
 */

import { createStore } from './store.js';
import { check } from './errors.js';
import { logFromLino, logToLino } from './log-lino.js';
import { decodeDocument, encodeDocument } from './doublets/encode.js';
import { readBundle, writeBundle } from './bundle.js';
import {
  inTransaction,
  deleteDatabase,
  openDatabase,
  request,
} from './idb/request.js';
import { SCHEMA_VERSION, STORES, databaseName, upgrade } from './idb/schema.js';

/** The store IDs of every element in pre-order. */
function storeIds(store) {
  const out = [];
  const walk = (ids) => {
    for (const id of ids) {
      out.push(id);
      walk(store.children(id));
    }
  };
  walk(store.roots());
  return out;
}

const sameList = (a, b) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/** Every row of every object store, in one `readonly` transaction. */
function readAll(db) {
  return inTransaction(db, STORES, 'readonly', async (s) => {
    const [links, names, log, meta] = await Promise.all([
      request(s.links.getAll()),
      request(s.names.getAll()),
      request(s.log.getAll()),
      request(s.meta.getAll()),
    ]);
    return {
      links,
      names: names.map(({ name, index }) => [name, index]),
      log,
      meta: Object.fromEntries(meta.map(({ key, value }) => [key, value])),
    };
  });
}

/**
 * Replace the snapshot in `stores` (inside an open transaction) and delete
 * the log rows it contains: those with `tx <= snapshotTx`, or all of them.
 */
function putSnapshot(stores, { document, ids, snapshotTx, clearLog }) {
  const encoded = encodeDocument(document);
  stores.links.clear();
  stores.names.clear();
  encoded.links.forEach((link) => stores.links.put({ ...link }));
  for (const [name, index] of encoded.names) {
    stores.names.put({ name, index });
  }
  const meta = { schemaVersion: SCHEMA_VERSION, roots: encoded.roots };
  Object.assign(meta, { ids, snapshotTx });
  for (const [key, value] of Object.entries(meta)) {
    stores.meta.put({ key, value });
  }
  if (clearLog) {
    stores.log.clear();
    return;
  }
  const cursor = stores.log.index('tx').openCursor();
  cursor.onsuccess = () => {
    const row = cursor.result;
    if (row && row.value.tx <= snapshotTx) {
      row.delete();
      row.continue();
    }
  };
}

/**
 * Build a store from the rows of the database: the snapshot, then the log
 * rows after it. `null` when the database has no snapshot.
 */
function build({ links, names, log, meta }, storeOptions) {
  if (meta.roots === undefined) {
    return null;
  }
  const document = decodeDocument({ links, names, roots: meta.roots });
  const store = createStore({ ...storeOptions, document, ids: meta.ids });
  const txMap = new Map();
  let lastTx = meta.snapshotTx;
  for (const row of log.filter((r) => r.tx > meta.snapshotTx)) {
    store.replay(logFromLino(row.lino));
    const entries = store.log();
    if (entries.length > 0) {
      txMap.set(entries[entries.length - 1].tx, row.tx);
    }
    lastTx = Math.max(lastTx, row.tx);
  }
  return { store, lastTx, txMap };
}

/**
 * The state of one open persistent store.
 * @typedef {object} Session
 * @property {string} name
 * @property {IDBDatabase} db
 * @property {BroadcastChannel | null} bc
 * @property {import('./index.js').Store} inner  the current store
 * @property {() => boolean} stopWriting
 * @property {number} lastTx  the last transaction number in the database
 * @property {Map<number, number>} txMap  store tx → persisted tx
 * @property {Promise<unknown>} queue  the writes, one after another
 * @property {unknown} failure  the first failed write since `flush()`
 * @property {boolean} closed
 * @property {Map<Function, () => boolean>} listeners  listener → unsubscribe on `inner`
 * @property {Set<() => void>} reloadListeners
 * @property {(error: unknown) => void} onError
 */

/** Run `job` after every queued job; its error goes to `flush()`. */
function enqueue(session, job) {
  const run = session.queue.then(job);
  session.queue = run.catch((error) => {
    session.failure ??= error;
    session.onError(error);
  });
  return run;
}

const notify = (session, tx) => session.bc?.postMessage({ tx });

const ensureOpen = (session) =>
  check(
    !session.closed,
    'closed',
    `The persistent store ${session.name} is closed`
  );

/** Append one committed transaction to the log. */
function append(session, entry) {
  return inTransaction(session.db, ['log', 'meta'], 'readwrite', async (s) => {
    const [newest, snapshot] = await Promise.all([
      request(s.log.index('tx').openCursor(null, 'prev')),
      request(s.meta.get('snapshotTx')),
    ]);
    const tx =
      Math.max(session.lastTx, newest?.value.tx ?? 0, snapshot?.value ?? 0) + 1;
    session.txMap.set(entry.tx, tx);
    const persisted = { ...entry, tx };
    for (const key of ['undoes', 'redoes']) {
      if (entry[key] !== undefined) {
        persisted[key] = session.txMap.get(entry[key]) ?? entry[key];
      }
    }
    s.log.add({ tx, lino: logToLino([persisted]) });
    session.lastTx = tx;
    return tx;
  }).then((tx) => notify(session, tx));
}

/** Make `next` the current store and move the listeners to it. */
function swap(session, next) {
  session.stopWriting();
  session.inner = next.store;
  session.lastTx = next.lastTx;
  session.txMap = next.txMap;
  session.stopWriting = next.store.subscribe((events, entry) => {
    enqueue(session, () => append(session, entry));
  });
  for (const [listener, unsubscribe] of session.listeners) {
    unsubscribe();
    session.listeners.set(listener, next.store.subscribe(listener));
  }
}

/** `swap`, then tell the `onReload` listeners. */
function replace(session, next) {
  swap(session, next);
  session.reloadListeners.forEach((listener) => listener());
}

/** Write a snapshot (and maybe log rows) in one transaction. */
const writeSnapshot = (session, snapshot, rows = []) =>
  inTransaction(session.db, STORES, 'readwrite', (s) => {
    putSnapshot(s, snapshot);
    rows.forEach((row) => s.log.add(row));
  });

/**
 * The store handed out: every method calls the current store, so it stays
 * valid when `reload()` or `importBundle()` replaces that store;
 * `subscribe` listeners move along.
 * @param {Session} session
 * @returns {import('./index.js').Store}
 */
function delegatingStore(session) {
  const { listeners } = session;
  const subscribe = (listener) => {
    listeners.get(listener)?.();
    listeners.set(listener, session.inner.subscribe(listener));
    return () => {
      const unsubscribe = listeners.get(listener);
      listeners.delete(listener);
      return unsubscribe ? unsubscribe() : false;
    };
  };
  return Object.freeze(
    Object.fromEntries(
      Object.keys(session.inner).map((key) => [
        key,
        key === 'subscribe'
          ? subscribe
          : (...args) => session.inner[key](...args),
      ])
    )
  );
}

/** Check a bundle completely and build its store; nothing is written. */
function prepareImport(text, limits, storeOptions) {
  const bundle = readBundle(text, limits);
  const store = createStore({
    ...storeOptions,
    document: bundle.document,
    ids: bundle.ids,
  });
  const ids = storeIds(store);
  const txMap = new Map();
  for (const entry of bundle.entries) {
    store.replay([entry]);
    txMap.set(store.log().at(-1).tx, entry.tx);
  }
  return {
    next: {
      store,
      lastTx: bundle.entries.at(-1)?.tx ?? bundle.snapshotTx,
      txMap,
    },
    snapshot: {
      document: bundle.document,
      ids,
      snapshotTx: bundle.snapshotTx,
      clearLog: true,
    },
    rows: bundle.entries.map((entry) => ({
      tx: entry.tx,
      lino: logToLino([entry]),
    })),
  };
}

/**
 * The `persistence` object of an open store.
 * @param {Session} session
 * @param {{ factory: IDBFactory, dbName: string, storeOptions: object, bundleLimits: object }} config
 */
function persistenceApi(session, config) {
  const { factory, dbName, storeOptions, bundleLimits } = config;
  const reload = () =>
    enqueue(session, async () => {
      ensureOpen(session);
      const next = build(await readAll(session.db), storeOptions);
      if (next) {
        replace(session, next);
      }
    });
  const persistence = Object.freeze({
    name: session.name,
    databaseName: dbName,
    /** Resolves when every queued write is done; rejects if one failed. */
    async flush() {
      await session.queue;
      if (session.failure) {
        const error = session.failure;
        session.failure = null;
        throw error;
      }
    },
    /** Write the current document as the snapshot and drop the old log. */
    compact() {
      ensureOpen(session);
      const document = session.inner.toDocument();
      const ids = storeIds(session.inner);
      return enqueue(session, async () => {
        const snapshotTx = session.lastTx;
        const snapshot = { document, ids, snapshotTx, clearLog: false };
        await writeSnapshot(session, snapshot);
        notify(session, snapshotTx);
      });
    },
    /** The bundle text of what the database holds. */
    async exportBundle() {
      ensureOpen(session);
      await persistence.flush();
      const { links, names, log, meta } = await readAll(session.db);
      const document = decodeDocument({ links, names, roots: meta.roots });
      const generated = storeIds(createStore({ document }));
      return writeBundle({
        name: session.name,
        snapshotTx: meta.snapshotTx,
        document,
        ids: meta.ids && !sameList(meta.ids, generated) ? meta.ids : undefined,
        entries: log
          .filter((row) => row.tx > meta.snapshotTx)
          .flatMap((row) => logFromLino(row.lino)),
      });
    },
    /**
     * Replace everything with the content of a bundle, in one IndexedDB
     * transaction. The bundle is checked first (limits, format, every
     * transaction replayed): on an error nothing changes.
     */
    async importBundle(text, limits = bundleLimits) {
      ensureOpen(session);
      const { next, snapshot, rows } = prepareImport(
        text,
        limits,
        storeOptions
      );
      await enqueue(session, async () => {
        await writeSnapshot(session, snapshot, rows);
        replace(session, next);
        notify(session, next.lastTx);
      });
    },
    reload,
    /** Call `listener()` after `reload()` or `importBundle()` replaced the store. */
    onReload(listener) {
      session.reloadListeners.add(listener);
      return () => session.reloadListeners.delete(listener);
    },
    /** The doublets table of the snapshot as stored in the database. */
    async readDoublets() {
      ensureOpen(session);
      await persistence.flush();
      const { links, names, meta } = await readAll(session.db);
      return { links, names: new Map(names), roots: meta.roots };
    },
    /**
     * Stop writing (edits after this stay in memory only), wait for the
     * queued writes and close the database and the channel.
     */
    async close() {
      if (session.closed) {
        return;
      }
      session.closed = true;
      session.stopWriting();
      session.bc?.close();
      await session.queue;
      session.db.close();
    },
    /** Close and delete the database. */
    async destroy() {
      await persistence.close();
      await deleteDatabase(factory, dbName);
    },
  });
  return persistence;
}

/**
 * @param {object} options
 * @param {string} options.name  the database is `link-ui-<name>`
 * @param {IDBFactory} [options.indexedDB]  default `globalThis.indexedDB`
 * @param {string} [options.initialText]  LiNo of a database without data
 * @param {boolean} [options.channel]  multi-tab notification (default `true`)
 * @param {typeof BroadcastChannel} [options.BroadcastChannel]
 * @param {object} [options.storeOptions]  more options of `createStore`
 * @param {{ maxDepth?: number, maxInputSize?: number }} [options.bundleLimits]
 * @param {(error: unknown) => void} [options.onError]  a write failed
 */
export async function openPersistentStore(options) {
  const {
    name,
    indexedDB: factory = globalThis.indexedDB,
    initialText,
    channel = true,
    BroadcastChannel: Channel = globalThis.BroadcastChannel,
    storeOptions = {},
    bundleLimits = {},
    onError = (error) => console.error(error),
  } = options ?? {};
  check(
    typeof name === 'string' && name.length > 0,
    'bad-op',
    'openPersistentStore needs a non-empty name'
  );
  check(factory, 'bad-op', 'No IndexedDB: pass the indexedDB option');
  const dbName = databaseName(name);
  const db = await openDatabase(factory, dbName, SCHEMA_VERSION, upgrade);
  // Let another connection delete or upgrade the database.
  db.onversionchange = () => db.close();

  /** @type {Session} */
  const session = {
    name,
    db,
    bc: channel && Channel ? new Channel(dbName) : null,
    inner: null,
    stopWriting: () => false,
    lastTx: 0,
    txMap: new Map(),
    queue: Promise.resolve(),
    failure: null,
    closed: false,
    listeners: new Map(),
    reloadListeners: new Set(),
    onError,
  };

  const first = build(await readAll(db), storeOptions);
  if (first) {
    swap(session, first);
  } else {
    const store = createStore({ ...storeOptions, text: initialText });
    const snapshot = { document: store.toDocument(), ids: storeIds(store) };
    await writeSnapshot(session, {
      ...snapshot,
      snapshotTx: 0,
      clearLog: true,
    });
    swap(session, { store, lastTx: 0, txMap: new Map() });
  }

  const store = delegatingStore(session);
  const persistence = persistenceApi(session, {
    factory,
    dbName,
    storeOptions,
    bundleLimits,
  });
  if (session.bc) {
    session.bc.onmessage = () => {
      if (!session.closed) {
        persistence.reload().catch(() => {});
      }
    };
  }
  return { store, persistence };
}
