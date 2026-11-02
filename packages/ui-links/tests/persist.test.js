/** Persistence adapters: localStorage, IndexedDB, Links Notation text, SQLite. */

import { describe, it, expect } from 'test-anywhere';
import { IDBFactory } from 'fake-indexeddb';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createMemoryLinks,
  createSqlLinks,
  indexedDbAdapter,
  linoTextAdapter,
  localStorageAdapter,
  persistLinks,
  triplesFromLino,
  triplesOf,
} from '@link-foundation/ui-links';
import { errorCode } from './helpers.js';

/** A Web Storage over a Map. */
function memoryStorage() {
  const items = new Map();
  return {
    get length() {
      return items.size;
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    items,
  };
}

/** Write a few links, then reopen and read them back. */
async function roundTrip(makeAdapter) {
  const first = await persistLinks(createMemoryLinks(), makeAdapter());
  const a = first.create();
  const b = first.create();
  const c = first.create();
  first.update(a, a, a);
  first.update(b, a, c);
  first.update(c, c, c);
  first.delete(a);
  await first.flush();
  const second = await persistLinks(createMemoryLinks(), makeAdapter());
  return triplesOf(second);
}

const expected = [
  [2, 1, 3],
  [3, 3, 3],
];

describe('persistence', () => {
  it('keeps links in localStorage, one key per link', async () => {
    const storage = memoryStorage();
    storage.setItem('other', 'kept');
    expect(await roundTrip(() => localStorageAdapter(storage))).toEqual(
      expected
    );
    expect(storage.getItem('links:3')).toBe('(3: 3 3)');
    expect(storage.getItem('other')).toBe('kept');
  });

  it('keeps links in IndexedDB', async () => {
    const indexedDB = new IDBFactory();
    const adapters = [];
    const open = () => {
      const adapter = indexedDbAdapter(indexedDB, 'links-test');
      adapters.push(adapter);
      return adapter;
    };
    expect(await roundTrip(open)).toEqual(expected);
    adapters.forEach((adapter) => adapter.close());
  });

  it('keeps links as Links Notation text', async () => {
    let text = '';
    const io = { read: () => text, write: (next) => (text = next) };
    expect(await roundTrip(() => linoTextAdapter(io))).toEqual(expected);
    expect(text).toBe('(2: 1 3)\n(3: 3 3)');
    expect(triplesFromLino(text)).toEqual(expected);
    expect(errorCode(() => triplesFromLino('(a: 1 2)'))).toBe('bad-request');
  });

  it('keeps links in a SQLite file', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'ui-links-'));
    try {
      const file = join(dir, 'links.db');
      const db = new DatabaseSync(file);
      const links = createSqlLinks(db);
      links.update(links.create(), 1, 1);
      db.close();
      const again = new DatabaseSync(file);
      expect(triplesOf(createSqlLinks(again))).toEqual([[1, 1, 1]]);
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
