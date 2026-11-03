/**
 * exportBundle / importBundle: the round trip into a new database and the
 * rejection of bundles that are too deep, too large or not bundles.
 */

import { describe, it, expect } from 'test-anywhere';
import { deepStrictEqual } from 'node:assert';
import { BUNDLE_HEAD } from '@link-foundation/ui-store';
import {
  freshIndexedDB,
  open,
  rows,
  seededEdits,
} from './persistence-helpers.js';

const STORES = ['links', 'names', 'log', 'meta'];
const dump = async (indexedDB, name) =>
  Object.fromEntries(
    await Promise.all(
      STORES.map(async (store) => [store, await rows(indexedDB, name, store)])
    )
  );

const codeOf = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error.code ?? error.name;
  }
  return 'no error';
};

describe('bundle', () => {
  it('round-trips into a new database', async () => {
    const source = await open(freshIndexedDB());
    seededEdits(source.store, 3, 30);
    await source.persistence.compact();
    // A named element: the seeded edits may have removed or renamed `ok`.
    source.store.insert(null, 0, { id: 'late', kind: 'text' });
    source.store.setPositional('late', ['late']);
    source.store.setProp('late', 'style', ['After compact']);
    const text = await source.persistence.exportBundle();
    expect(
      text.startsWith(`${BUNDLE_HEAD}\n  schema 1\n  name demo\n  snapshot_tx `)
    ).toBe(true);
    expect(text).toContain('\ndocument\n');
    expect(text).toContain('\ntx ');

    const targetDB = freshIndexedDB();
    const target = await open(targetDB, { name: 'copy' });
    let reloads = 0;
    target.persistence.onReload(() => reloads++);
    await target.persistence.importBundle(text);
    expect(target.store.toLino()).toBe(source.store.toLino());
    deepStrictEqual(target.store.toDocument(), source.store.toDocument());
    expect(await target.persistence.exportBundle()).toBe(
      text.replace('\n  name demo\n', '\n  name copy\n')
    );
    expect(reloads).toBe(1);
    // Edits after the import continue the transaction numbers.
    target.store.setProp('late', 'variant', ['imported']);
    const edited = target.store.toLino();
    await target.persistence.close();
    const again = await open(targetDB, { name: 'copy' });
    expect(again.store.toLino()).toBe(edited);
    const txs = (await rows(targetDB, 'copy', 'log')).map((row) => row.tx);
    expect(txs).toEqual([...txs].sort((a, b) => a - b));
    expect(new Set(txs).size).toBe(txs.length);
    await again.persistence.close();
    await source.persistence.close();
  });

  it('writes the exact document_tree only when the text is not enough', async () => {
    const source = await open(freshIndexedDB());
    const plain = await source.persistence.exportBundle();
    expect(plain).not.toContain('document_tree');
    // A property named like a kind would be read back from text as a child.
    source.store.setProp('ok', 'text', ['not a child']);
    source.store.setProp(source.store.roots()[1], 'label', [
      ['nested', { id: 'v', values: ['w'] }],
    ]);
    await source.persistence.compact();
    const exact = await source.persistence.exportBundle();
    expect(exact).toContain('\ndocument_tree\n  roots\n    e');
    const target = await open(freshIndexedDB(), { name: 'copy' });
    await target.persistence.importBundle(exact);
    deepStrictEqual(target.store.toDocument(), source.store.toDocument());
    const broken = exact.replace(
      '\ndocument_tree\n  roots\n    e',
      '\ndocument_tree\n  roots\n    x'
    );
    expect(await codeOf(target.persistence.importBundle(broken))).toBe(
      'bad-bundle'
    );
    deepStrictEqual(target.store.toDocument(), source.store.toDocument());
    await source.persistence.close();
    await target.persistence.close();
  });

  it('rejects bundles over the limits and leaves the data alone', async () => {
    const indexedDB = freshIndexedDB();
    const { store, persistence } = await open(indexedDB);
    store.setProp('ok', 'label', ['Kept']);
    const before = store.toLino();
    await persistence.flush();
    const saved = await dump(indexedDB, 'demo');
    const good = await persistence.exportBundle();

    const deep = good.replace(
      '\ndocument\n',
      `\ndocument ${'('.repeat(40)}x${')'.repeat(40)}\n`
    );
    expect(await codeOf(persistence.importBundle(deep, { maxDepth: 20 }))).toBe(
      'UiParseError'
    );
    expect(
      await codeOf(persistence.importBundle(good, { maxInputSize: 50 }))
    ).toBe('UiParseError');
    const big = `${good}\n(note ${'x'.repeat(2 * 1024 * 1024)})\n`;
    expect(await codeOf(persistence.importBundle(big))).toBe('UiParseError');

    const broken = [
      '(something_else (schema 1))',
      good.replace('\n  schema 1\n', '\n  schema 2\n'),
      good.replace(/\n {2}snapshot_tx \d+\n/u, '\n  snapshot_tx -1\n'),
      good.replace('\ndocument\n', '\ndoc\n'),
      `${good}(tx 1 (origin user) (setProp ok label X))\n`,
    ];
    for (const text of broken) {
      expect(await codeOf(persistence.importBundle(text))).toBe('bad-bundle');
    }
    expect(
      await codeOf(persistence.importBundle(`${good}(tx 99 (frobnicate))\n`))
    ).toBe('bad-log');
    expect(
      await codeOf(
        persistence.importBundle(
          `${good}(tx 99 (origin user) (setProp nowhere label X))\n`
        )
      )
    ).toBe('unknown-id');

    expect(store.toLino()).toBe(before);
    await persistence.flush();
    deepStrictEqual(await dump(indexedDB, 'demo'), saved);
    await persistence.close();
  });
});
