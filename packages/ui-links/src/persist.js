/**
 * Persistence for any storage: load the links an adapter keeps, then write
 * every change through to it. An adapter is
 *
 * - `load()` → the stored links as `[id, source, target]` (or a promise);
 * - `put(id, source, target)` and `remove(id)`: one change;
 * - `flush()` (optional): a promise that the writes so far are stored.
 *
 * Adapters here: `localStorage` (one key per link), IndexedDB (one record
 * per link) and Links Notation text (the whole store, link-cli's format).
 * The SQL storage (`createSqlLinks`) needs none: it is persistent itself.
 */

import { formatLinks, parseLinks } from '@link-foundation/ui-core';
import { observe } from './decorators.js';
import { allLinks, ensureCreated, LinksError } from './links.js';
import { formatLino, named, parseLino } from './lino.js';

/**
 * Load what `adapter` keeps into `links`; the result is `links` writing
 * every change through to `adapter`, with `flush()`.
 * @param {any} links  an empty storage, usually the memory one
 * @param {any} adapter
 */
export async function persistLinks(links, adapter) {
  const stored = await adapter.load();
  const sorted = [...stored].sort((a, b) => a[0] - b[0]);
  for (const [id] of sorted) {
    ensureCreated(links, id);
  }
  for (const [id, source, target] of sorted) {
    links.update(id, source, target);
  }
  const persisted = observe(links, ({ after, before }) => {
    if (after === null) {
      adapter.remove(before.id);
    } else {
      adapter.put(after.id, after.from_id, after.to_id);
    }
  });
  persisted.flush = async () => {
    await adapter.flush?.();
  };
  return persisted;
}

/** `(id: source target)` as one LiNo line. */
const lineOf = (id, source, target) =>
  formatLino([named(String(id), [String(source), String(target)])]);

/** `[id, source, target]` from `(id: source target)` lines. */
export function triplesFromLino(text) {
  return parseLino(text).map((link) => {
    const parts = typeof link === 'string' ? [] : [link.id, ...link.values];
    if (parts.length !== 3 || parts.some((p) => !/^[0-9]+$/.test(p))) {
      throw new LinksError(
        'bad-request',
        `Expected (index: source target), found ${formatLino([link])}`
      );
    }
    return parts.map(Number);
  });
}

/**
 * Keep links in a Web Storage (`localStorage`, `sessionStorage`): the key
 * `prefix + id` holds `(id: source target)`.
 * @param {Storage} storage
 * @param {string} [prefix]
 */
export function localStorageAdapter(storage, prefix = 'links:') {
  return {
    load() {
      const text = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null && key.startsWith(prefix) && key !== `${prefix}sync`) {
          text.push(storage.getItem(key));
        }
      }
      return triplesFromLino(text.join('\n'));
    },
    loadState: () => storage.getItem(`${prefix}sync`),
    saveState: (text) => storage.setItem(`${prefix}sync`, text),
    put: (id, source, target) =>
      storage.setItem(`${prefix}${id}`, lineOf(id, source, target)),
    remove: (id) => storage.removeItem(`${prefix}${id}`),
  };
}

/**
 * Keep links in IndexedDB: the object store `links` of the database `name`
 * holds `{ id, source, target }` records. Writes are queued in order;
 * `flush()` waits for them.
 * @param {IDBFactory} indexedDB
 * @param {string} name
 */
export function indexedDbAdapter(indexedDB, name) {
  const request = (req) =>
    new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  let db = null;
  let tail = Promise.resolve();
  let failure = null;
  const write = (fn, name = 'links') => {
    const tx = db.transaction(name, 'readwrite');
    fn(tx.objectStore(name));
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    tail = tail
      .then(() => done)
      .catch((error) => {
        failure ??= error;
      });
  };
  return {
    async load() {
      const open = indexedDB.open(name, 2);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('links')) {
          open.result.createObjectStore('links', { keyPath: 'id' });
        }
        open.result.createObjectStore('sync');
      };
      db = await request(open);
      const records = await request(
        db.transaction('links').objectStore('links').getAll()
      );
      return records.map((r) => [r.id, r.source, r.target]);
    },
    loadState: () =>
      request(db.transaction('sync').objectStore('sync').get('state')),
    saveState: (text) => write((store) => store.put(text, 'state'), 'sync'),
    put: (id, source, target) =>
      write((store) => store.put({ id, source, target })),
    remove: (id) => write((store) => store.delete(id)),
    async flush() {
      await tail;
      if (failure) {
        const error = failure;
        failure = null;
        throw error;
      }
    },
    close: () => db?.close(),
  };
}

/**
 * Keep links as Links Notation text, `(id: source target)` per line, the
 * format of link-cli's `--out`: `read()` gives the text (empty when there is
 * none), `write(text)` stores it after every change.
 * @param {{ read: () => string | Promise<string>, write: (text: string) => void }} io
 */
export function linoTextAdapter({ read, write }) {
  const links = new Map();
  let state = null;
  const save = () =>
    write(
      [...links.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, [source, target]]) => lineOf(id, source, target))
        .concat(state ? state.trimEnd() : [])
        .join('\n')
    );
  return {
    async load() {
      const document = parseLinks((await read()) ?? '');
      const checkpoint = document.find((v) => v.id === 'sync');
      state = checkpoint ? formatLinks([checkpoint]) : null;
      const triples = triplesFromLino(
        formatLino(document.filter((v) => v.id !== 'sync'))
      );
      for (const [id, source, target] of triples) {
        links.set(id, [source, target]);
      }
      return triples;
    },
    loadState: () => state,
    saveState(text) {
      state = text;
      save();
    },
    put(id, source, target) {
      links.set(id, [source, target]);
      save();
    },
    remove(id) {
      links.delete(id);
      save();
    },
  };
}

/** Every link of `links` as `[id, source, target]`. */
export const triplesOf = (links) =>
  allLinks(links).map((l) => [l.id, l.from_id, l.to_id]);
