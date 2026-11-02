/**
 * Every storage keeps the same doublets interface: memory, SQLite
 * (node:sqlite) and doublets-web run the same cases.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  ANY,
  BREAK,
  CONTINUE,
  MAX_ADDRESS,
  allLinks,
  createMemoryLinks,
  createSqlLinks,
  ensureCreated,
  getLink,
  openDoubletsWebLinks,
  search,
} from '@link-foundation/ui-links';
import { errorCode } from './helpers.js';

const storages = [
  ['memory', () => createMemoryLinks()],
  [
    'SQLite',
    async () => {
      const { DatabaseSync } = await import('node:sqlite');
      return createSqlLinks(new DatabaseSync(':memory:'));
    },
  ],
  ['doublets-web', () => openDoubletsWebLinks()],
];

for (const [name, open] of storages) {
  describe(`storage: ${name}`, () => {
    it('creates, updates, reads and deletes links', async () => {
      const links = await open();
      const a = links.create();
      const b = links.create();
      expect([a, b]).toEqual([1, 2]);
      links.update(a, a, a);
      links.update(b, a, b);
      expect(allLinks(links)).toEqual([
        { id: 1, from_id: 1, to_id: 1 },
        { id: 2, from_id: 1, to_id: 2 },
      ]);
      expect(links.count([])).toBe(2);
      expect(links.count({ from_id: 1 })).toBe(2);
      expect(links.count([ANY, ANY, 2])).toBe(1);
      expect(getLink(links, 2)).toEqual({ id: 2, from_id: 1, to_id: 2 });
      expect(getLink(links, 3)).toBe(null);
      expect(search(links, 1, 2)?.id).toBe(2);
      links.delete(b);
      expect(allLinks(links).map((l) => l.id)).toEqual([1]);
    });

    it('stops each() at BREAK', async () => {
      const links = await open();
      for (let i = 0; i < 5; i++) {
        links.create();
      }
      const seen = [];
      const result = links.each((link) => {
        seen.push(link.id);
        return seen.length === 2 ? BREAK : CONTINUE;
      }, []);
      expect(result).toBe(BREAK);
      expect(seen.length).toBe(2);
    });

    it('throws not-found and bad-reference with a code', async () => {
      const links = await open();
      links.create();
      expect(errorCode(() => links.update(9, 0, 0))).toBe('not-found');
      expect(errorCode(() => links.delete(9))).toBe('not-found');
      expect(errorCode(() => links.update(1, -1, 0))).toBe('bad-reference');
      expect(errorCode(() => links.update(1, 0, MAX_ADDRESS + 1))).toBe(
        'bad-reference'
      );
    });

    it('ensureCreated makes the link at an address', async () => {
      const links = await open();
      expect(ensureCreated(links, 4)).toBe(true);
      expect(ensureCreated(links, 4)).toBe(false);
      expect(getLink(links, 4)).toEqual({ id: 4, from_id: 0, to_id: 0 });
      expect(links.count([])).toBe(1);
    });
  });
}

describe('storage: memory addresses', () => {
  it('reuses freed addresses and takes far ones with createAt', () => {
    const links = createMemoryLinks();
    links.create();
    links.create();
    links.create();
    links.delete(2);
    expect(links.create()).toBe(2);
    links.createAt(MAX_ADDRESS);
    expect(links.create()).toBe(4);
    expect(errorCode(() => links.createAt(4))).toBe('exists');
    expect(errorCode(() => links.createAt(0))).toBe('bad-reference');
  });
});
