/**
 * writeDocumentLinks / readDocumentLinks: a document's doublets in the
 * storages of `@link-foundation/ui-links` (memory, SQLite, IndexedDB through
 * its persistence adapter) and on a links server through a synced client,
 * next to other data. doublets-web is skipped, with the reason in the test
 * name, where it cannot be loaded (Bun).
 */

import { describe, it, expect } from 'test-anywhere';
import { IDBFactory } from 'fake-indexeddb';
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createNames,
  createSqlLinks,
  createSyncedLinks,
  indexedDbAdapter,
  openDoubletsWebLinks,
  persistLinks,
  typeMarkers,
  typeSystem,
} from '@link-foundation/ui-links';
import {
  createStore,
  encodeDocument,
  readDocumentLinks,
  writeDocumentLinks,
} from '@link-foundation/ui-store';
import { TEXT } from './persistence-helpers.js';

const store = createStore({ text: TEXT });
const encoded = encodeDocument(store.toDocument());

let doubletsWeb;
let reason;
try {
  doubletsWeb = await openDoubletsWebLinks();
} catch (error) {
  reason = `doublets-web cannot be loaded here: ${error.message}`;
}
/** `it`, or `it.skip` with the reason in the name (see web-adapter.test.js). */
const itWithDoubletsWeb = reason
  ? (name, fn) => it.skip(`${name} (skipped: ${reason})`, fn)
  : it;

describe('writeDocumentLinks and readDocumentLinks', () => {
  it('round-trips a document through a memory storage', () => {
    const links = createMemoryLinks();
    const where = writeDocumentLinks(encoded, links);
    // Each element and both roots have a stable handle in addition to
    // their immutable encoding fragments.
    expect(links.count([])).toBeGreaterThan(encoded.links.length);
    expect(where.roots).not.toEqual(encoded.roots);
    const back = readDocumentLinks(links, where);
    expect(back.roots).toEqual(store.toDocument().roots);
  });

  it('keeps the document apart from other data, names in a names store', () => {
    const links = createMemoryLinks();
    const names = createNames();
    const types = typeSystem(links, typeMarkers(links, names));
    types.define();
    const where = writeDocumentLinks(encoded, links, names);
    expect(where.roots[0]).toBeGreaterThan(encoded.roots[0]);
    expect(names.getName(where.names.get('ok'))).toBe('ok');
    const back = readDocumentLinks(links, { names, roots: where.roots });
    expect(back.roots).toEqual(store.toDocument().roots);
    expect(back.byId.has('ok')).toBe(true);
  });

  it('round-trips through SQLite and IndexedDB', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const sql = createSqlLinks(new DatabaseSync(':memory:'));
    expect(
      readDocumentLinks(sql, writeDocumentLinks(encoded, sql)).roots
    ).toEqual(store.toDocument().roots);

    const indexedDB = new IDBFactory();
    const adapters = [];
    const open = () => {
      adapters.push(indexedDbAdapter(indexedDB, 'doc'));
      return persistLinks(createMemoryLinks(), adapters.at(-1));
    };
    const first = await open();
    const where = writeDocumentLinks(encoded, first);
    await first.flush();
    const second = await open();
    expect(readDocumentLinks(second, where).roots).toEqual(
      store.toDocument().roots
    );
    adapters.forEach((adapter) => adapter.close());
  });

  itWithDoubletsWeb('round-trips through doublets-web', () => {
    const where = writeDocumentLinks(encoded, doubletsWeb);
    expect(readDocumentLinks(doubletsWeb, where).roots).toEqual(
      store.toDocument().roots
    );
  });

  it('shares a document through a links server', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const writer = createSyncedLinks({ transport: connectInProcess(server) });
    const where = writeDocumentLinks(encoded, writer);
    await writer.flush();
    const roots = where.roots.map(writer.resolve);
    const names = new Map(
      [...where.names].map(([name, id]) => [name, writer.resolve(id)])
    );
    const reader = createSyncedLinks({ transport: connectInProcess(server) });
    await reader.load([]);
    const back = readDocumentLinks(reader, { names, roots });
    expect(back.roots).toEqual(store.toDocument().roots);
  });

  it('reads legacy immutable graphs without unescaping literal names', () => {
    const document = createStore({ text: 'a: text !literal' }).toDocument();
    const legacy = encodeDocument(document);
    const links = createMemoryLinks();
    for (const link of legacy.links) {
      expect(links.create()).toBe(link.index);
      links.update(link.index, link.source, link.target);
    }
    const names = createNames();
    for (const [name, id] of legacy.names) {
      names.setName(id, name);
    }
    expect(
      readDocumentLinks(links, { roots: legacy.roots, names }).roots
    ).toEqual(document.roots);
  });

  it('rejects a root that is missing', () => {
    let code = null;
    try {
      readDocumentLinks(createMemoryLinks(), {
        names: new Map(),
        roots: [5, 6],
      });
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('bad-doublets');
  });
});
