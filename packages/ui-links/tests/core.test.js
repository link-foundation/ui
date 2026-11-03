/** Decorators, names and Links Notation. */

import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  createMemoryLinks,
  createNames,
  decodeBinary,
  deleteCascade,
  dependentsOf,
  encodeBinary,
  formatLino,
  isBinary,
  isName,
  linksFromLino,
  linksToLino,
  named,
  namesFromLino,
  namesToLino,
  netChanges,
  observe,
  parseLino,
  withCascade,
} from '@link-foundation/ui-links';
import { errorCode } from './helpers.js';

/** A storage with `1: 1 1`, `2: 1 2` and `3: 2 2`. */
function chain() {
  const links = createMemoryLinks();
  for (const [s, t] of [
    [1, 1],
    [1, 2],
    [2, 2],
  ]) {
    links.update(links.create(), s, t);
  }
  return links;
}

describe('decorators', () => {
  it('observe reports create, update and delete', () => {
    const changes = [];
    const links = observe(createMemoryLinks(), (c) => changes.push(c));
    const id = links.create();
    links.update(id, id, id);
    links.delete(id);
    expect(changes).toEqual([
      { before: null, after: { id: 1, from_id: 0, to_id: 0 } },
      {
        before: { id: 1, from_id: 0, to_id: 0 },
        after: { id: 1, from_id: 1, to_id: 1 },
      },
      { before: { id: 1, from_id: 1, to_id: 1 }, after: null },
    ]);
  });

  it('deletes the links that use a deleted link', () => {
    const links = chain();
    expect(dependentsOf(links, 2).map((l) => l.id)).toEqual([2, 3]);
    withCascade(links).delete(1);
    expect(links.count([])).toBe(0);
    expect(errorCode(() => deleteCascade(links, 1))).toBe('not-found');
  });

  it('netChanges folds the changes of each link', () => {
    const changes = [];
    const links = observe(createMemoryLinks(), (c) => changes.push(c));
    const a = links.create();
    links.update(a, a, a);
    const b = links.create();
    links.delete(b);
    expect(netChanges(changes)).toEqual([
      { before: null, after: { id: 1, from_id: 1, to_id: 1 } },
    ]);
  });
});

describe('names', () => {
  it('keeps one name per link and one link per name', () => {
    const names = createNames([[1, 'a']]);
    names.setName(2, 'a');
    expect(names.getName(1)).toBe(null);
    expect(names.getByName('a')).toBe(2);
    expect(names.removeName(2)).toBe(true);
    expect(names.removeName(2)).toBe(false);
  });

  it('refuses what reads as something else in a query', () => {
    expect(['a pair', 'x'].map(isName)).toEqual([true, true]);
    expect(['', '*', '$x', '12'].map(isName)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(errorCode(() => createNames().setName(1, '7'))).toBe('bad-request');
    expect(errorCode(() => createNames().setName(0, 'x'))).toBe(
      'bad-reference'
    );
  });
});

describe('Links Notation', () => {
  it('exports and imports links with names', () => {
    const names = createNames();
    const links = createMemoryLinks();
    expect(linksFromLino(links, '(p: x y)', { names })).toEqual([1]);
    expect(linksToLino(links, { names })).toBe('(p: x y)\n(x: x x)\n(y: y y)');
    expect(namesToLino(names)).toBe('(1: p)\n(2: x)\n(3: y)');
    const copy = namesFromLino(createNames(), namesToLino(names));
    expect(copy.getByName('y')).toBe(3);
    const other = createMemoryLinks();
    linksFromLino(other, linksToLino(links));
    expect(allLinks(other)).toEqual(allLinks(links));
  });

  it('refuses lines that are not links', () => {
    expect(errorCode(() => linksFromLino(createMemoryLinks(), '(1 2)'))).toBe(
      'bad-request'
    );
    expect(
      errorCode(() => linksFromLino(createMemoryLinks(), '(1: x x)'))
    ).toBe('bad-reference');
  });

  it('round-trips the binary form', () => {
    const document = [named('count', ['2']), named(null, ['1', '2'])];
    const bytes = encodeBinary(document);
    expect(isBinary(bytes)).toBe(true);
    expect(isBinary(new TextEncoder().encode('(count: 2)'))).toBe(false);
    const decoded = decodeBinary(bytes);
    expect(formatLino(decoded.document)).toBe(formatLino(document));
    expect(decodeBinary(bytes.subarray(0, bytes.length - 1))).toBe(null);
    expect(formatLino(parseLino("(name: 'a pair')"))).toBe("(name: 'a pair')");
  });
});
