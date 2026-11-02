/**
 * openPersistentStore: write-through to IndexedDB, reload, undo after a
 * reload, destroy() and the BroadcastChannel between tabs.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore, logFromLino } from '@link-foundation/ui-store';
import {
  TEXT,
  freshIndexedDB,
  nextReload,
  open,
  rows,
  seededEdits,
} from './persistence-helpers.js';

describe('openPersistentStore', () => {
  it('starts from initialText and writes the snapshot', async () => {
    const indexedDB = freshIndexedDB();
    const { store, persistence } = await open(indexedDB);
    expect(store.toLino()).toBe(createStore({ text: TEXT }).toLino());
    expect(persistence.databaseName).toBe('link-ui-demo');
    await persistence.close();
    const meta = await rows(indexedDB, 'demo', 'meta');
    expect(meta.map((row) => row.key).sort()).toEqual([
      'ids',
      'roots',
      'schemaVersion',
      'snapshotTx',
    ]);
    expect((await rows(indexedDB, 'demo', 'links')).length).toBeGreaterThan(0);
    expect(await rows(indexedDB, 'demo', 'log')).toEqual([]);
  });

  it('survives a reopen after 50 seeded edits; undo works after it', async () => {
    const indexedDB = freshIndexedDB();
    const first = await open(indexedDB);
    const committed = seededEdits(first.store, 50, 50);
    expect(committed).toBeGreaterThan(40);
    const text = first.store.toLino();
    await first.persistence.close();

    const log = await rows(indexedDB, 'demo', 'log');
    expect(log.length).toBe(committed);
    expect(log.map((row) => row.tx)).toEqual(log.map((row, i) => i + 1));
    expect(logFromLino(log[0].lino)[0].tx).toBe(1);

    const second = await open(indexedDB, { initialText: '(other)' });
    expect(second.store.toLino()).toBe(text);
    const id = second.store.insert(null, 0, {
      kind: 'text',
      positional: ['after reopen'],
    });
    second.store.setProp(id, 'label', ['new']);
    expect(second.store.undo()).toBe(true);
    expect(second.store.undo()).toBe(true);
    expect(second.store.toLino()).toBe(text);
    expect(second.store.redo()).toBe(true);
    const redone = second.store.toLino();
    await second.persistence.close();

    const third = await open(indexedDB);
    expect(third.store.toLino()).toBe(redone);
    const persisted = (await rows(indexedDB, 'demo', 'log')).map(
      (row) => logFromLino(row.lino)[0]
    );
    const after = persisted.slice(committed);
    expect(after.map((entry) => entry.origin)).toEqual([
      'user',
      'user',
      'undo',
      'undo',
      'redo',
    ]);
    expect(after.map((entry) => entry.tx)).toEqual(
      [1, 2, 3, 4, 5].map((n) => committed + n)
    );
    expect([after[2].undoes, after[3].undoes, after[4].redoes]).toEqual([
      committed + 2,
      committed + 1,
      committed + 1,
    ]);
    await third.persistence.destroy();
  });

  it('keeps listeners and history in memory; flush() waits for writes', async () => {
    const indexedDB = freshIndexedDB();
    const { store, persistence } = await open(indexedDB);
    const seen = [];
    const stop = store.subscribe((events, entry) => seen.push(entry.tx));
    store.setProp('ok', 'label', ['A']);
    store.transaction('two', () => {
      store.setProp('ok', 'label', ['B']);
      store.setProp('ok', 'variant', ['primary']);
    });
    expect(seen).toEqual([1, 2]);
    expect(stop()).toBe(true);
    await persistence.flush();
    expect((await rows(indexedDB, 'demo', 'log')).length).toBe(2);
    await persistence.close();
    store.setProp('ok', 'label', ['C']);
    await persistence.flush();
    expect((await rows(indexedDB, 'demo', 'log')).length).toBe(2);
  });

  it('rejects a bad name and a missing IndexedDB', async () => {
    for (const options of [{ name: '' }, { indexedDB: null }]) {
      let code;
      try {
        await open(options.indexedDB ?? freshIndexedDB(), options);
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('bad-op');
    }
  });

  it('destroy() deletes the database', async () => {
    const indexedDB = freshIndexedDB();
    const { store, persistence } = await open(indexedDB);
    store.setProp('ok', 'label', ['A']);
    await persistence.destroy();
    const oldVersion = await new Promise((resolve, reject) => {
      const request = indexedDB.open('link-ui-demo', 1);
      let version;
      request.onupgradeneeded = (event) => {
        version = event.oldVersion;
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.close();
        resolve(version);
      };
    });
    expect(oldVersion).toBe(0);
    let code;
    try {
      await persistence.compact();
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('closed');
  });

  it('tells other tabs to reload through a BroadcastChannel', async () => {
    const indexedDB = freshIndexedDB();
    const name = 'tabs';
    const a = await open(indexedDB, { name, channel: true });
    const b = await open(indexedDB, { name, channel: true });
    const seen = [];
    b.store.subscribe((events, entry) => seen.push(entry.origin));
    const reloaded = nextReload(b.persistence);
    a.store.setProp('ok', 'label', ['From A']);
    await a.persistence.flush();
    await reloaded;
    expect(b.store.toLino()).toBe(a.store.toLino());
    b.store.setProp('ok', 'variant', ['from-b']);
    expect(seen).toEqual(['user']);
    const back = nextReload(a.persistence);
    await b.persistence.flush();
    await back;
    expect(a.store.get('ok').properties).toEqual(b.store.get('ok').properties);
    await a.persistence.close();
    await b.persistence.destroy();
  });
});
