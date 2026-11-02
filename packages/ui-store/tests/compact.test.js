/**
 * persistence.compact(): the snapshot is rewritten and the log emptied.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  freshIndexedDB,
  open,
  rows,
  seededEdits,
} from './persistence-helpers.js';

describe('compact', () => {
  it('empties the log; the reloaded document is identical', async () => {
    const indexedDB = freshIndexedDB();
    const first = await open(indexedDB);
    seededEdits(first.store, 7, 40);
    await first.persistence.flush();
    expect((await rows(indexedDB, 'demo', 'log')).length).toBeGreaterThan(0);
    await first.persistence.compact();
    expect(await rows(indexedDB, 'demo', 'log')).toEqual([]);
    const meta = await rows(indexedDB, 'demo', 'meta');
    const snapshotTx = meta.find((row) => row.key === 'snapshotTx').value;
    expect(snapshotTx).toBe(first.store.log().length);
    const text = first.store.toLino();
    await first.persistence.close();

    const second = await open(indexedDB);
    expect(second.store.toLino()).toBe(text);
    await second.persistence.close();
  });

  it('keeps the store IDs of anonymous elements for later edits', async () => {
    const indexedDB = freshIndexedDB();
    const first = await open(indexedDB);
    // `_5` is generated; after a removal a reload would number differently.
    const added = first.store.insert(null, 0, {
      kind: 'text',
      positional: ['x'],
    });
    first.store.remove(first.store.roots()[1]);
    await first.persistence.compact();
    first.store.setProp(added, 'label', ['after compact']);
    first.store.move(added, null, 1);
    const text = first.store.toLino();
    await first.persistence.close();
    expect((await rows(indexedDB, 'demo', 'log')).length).toBe(2);

    const second = await open(indexedDB);
    expect(second.store.toLino()).toBe(text);
    expect(second.store.get(added).name).toBe(null);
    await second.persistence.compact();
    await second.persistence.close();
    const third = await open(indexedDB);
    expect(third.store.toLino()).toBe(text);
    await third.persistence.close();
  });

  it('keeps the edits made while a compaction is queued', async () => {
    const indexedDB = freshIndexedDB();
    const { store, persistence } = await open(indexedDB);
    store.setProp('ok', 'label', ['A']);
    const compacted = persistence.compact();
    store.setProp('ok', 'label', ['B']);
    await compacted;
    await persistence.flush();
    expect((await rows(indexedDB, 'demo', 'log')).map((r) => r.tx)).toEqual([
      2,
    ]);
    await persistence.close();
    const again = await open(indexedDB);
    expect(again.store.get('ok').properties).toEqual([
      { name: 'label', values: ['B'] },
    ]);
    await again.persistence.close();
  });
});
