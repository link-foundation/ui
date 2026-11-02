/**
 * copyToDoubletsWeb: the doublets of a document in a doublets-web
 * `UnitedLinks` store. The real store runs when `doublets-web` (a
 * WebAssembly module built for bundlers) can be loaded by this runtime;
 * otherwise that test is skipped with the reason in its name (`it.skip` is
 * the only skip that Node.js, Bun and Deno all report, and none prints a
 * reason; see tests/helpers/skip.js of the repository).
 */

import { describe, it } from 'test-anywhere';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import {
  copyToDoubletsWeb,
  createStore,
  encodeDocument,
  openDoubletsWeb,
} from '@link-foundation/ui-store';
import { TEXT } from './persistence-helpers.js';

/** A `UnitedLinks` stand-in: links are `[source, target]`, from index 1. */
function fakeUnitedLinks() {
  const links = [];
  return {
    links,
    create: () => links.push([0, 0]),
    update: (index, source, target) => {
      links[index - 1] = [source, target];
      return index;
    },
    count: () => links.length,
  };
}

const encoded = encodeDocument(createStore({ text: TEXT }).toDocument());

let loaded;
let reason;
try {
  loaded = await openDoubletsWeb();
} catch (error) {
  reason = `doublets-web cannot be loaded here: ${error.message}`;
}
/** `it`, or `it.skip` with the reason in the name. */
const itWithDoubletsWeb = reason
  ? (name, fn) => it.skip(`${name} (skipped: ${reason})`, fn)
  : it;

describe('copyToDoubletsWeb', () => {
  it('creates every triple in index order (stand-in store)', () => {
    const links = fakeUnitedLinks();
    const map = copyToDoubletsWeb(encoded, links);
    strictEqual(links.count(), encoded.links.length);
    deepStrictEqual(
      links.links,
      encoded.links.map((l) => [map.get(l.source), map.get(l.target)])
    );
    deepStrictEqual([...map.keys()], [...map.values()]);
  });

  it('maps indexes when the store is not empty', () => {
    const links = fakeUnitedLinks();
    links.create();
    const map = copyToDoubletsWeb(encoded, links);
    strictEqual(map.get(1), 2);
    deepStrictEqual(links.links[1], [2, 2]);
  });

  it('rejects a link that refers to a later one', () => {
    const forward = {
      links: [
        { index: 1, source: 1, target: 1 },
        { index: 2, source: 3, target: 1 },
      ],
    };
    throws(() => copyToDoubletsWeb(forward, fakeUnitedLinks()), RangeError);
  });

  itWithDoubletsWeb(
    'fills a doublets-web UnitedLinks: count() is the number of triples',
    () => {
      const map = copyToDoubletsWeb(encoded, loaded.links);
      strictEqual(Number(loaded.links.count()), encoded.links.length);
      strictEqual(map.size, encoded.links.length);
    }
  );
});
