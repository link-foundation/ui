/**
 * link-cli's substitution queries: the examples of its README, replayed on
 * the memory storage.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  createMemoryLinks,
  createNames,
  linksToLino,
  runQuery,
  transact,
} from '@link-foundation/ui-links';
import { errorCode } from './helpers.js';

const show = (link) =>
  link === null ? '()' : `((${link.id}: ${link.from_id} ${link.to_id}))`;

/** Run `steps` (`[query, changes, links]`) on one fresh storage. */
function replay(steps, options = {}) {
  const links = createMemoryLinks();
  const names = createNames();
  for (const [query, changes, after] of steps) {
    const got = runQuery({ links, names, ...options }, query).map(
      ({ before, after: next }) => `${show(before)} ${show(next)}`
    );
    expect([query, got]).toEqual([query, changes]);
    expect([query, linksToLino(links, { names })]).toEqual([query, after]);
  }
  return { links, names };
}

describe('substitution queries', () => {
  it('creates, reads, updates and deletes by address', () => {
    replay([
      ['() ((1 1))', ['() ((1: 1 1))'], '(1: 1 1)'],
      ['() ((2 2))', ['() ((2: 2 2))'], '(1: 1 1)\n(2: 2 2)'],
      [
        '((($i: $s $t)) (($i: $s $t)))',
        ['((1: 1 1)) ((1: 1 1))', '((2: 2 2)) ((2: 2 2))'],
        '(1: 1 1)\n(2: 2 2)',
      ],
      [
        '((($i:)) (($i:)))',
        ['((1: 1 1)) ((1: 1 1))', '((2: 2 2)) ((2: 2 2))'],
        '(1: 1 1)\n(2: 2 2)',
      ],
      [
        '((1: 1 1)) ((1: 1 2))',
        ['((1: 1 1)) ((1: 1 2))'],
        '(1: 1 2)\n(2: 2 2)',
      ],
      ['((1 2)) ()', ['((1: 1 2)) ()'], '(2: 2 2)'],
      ['((2 2)) ()', ['((2: 2 2)) ()'], ''],
    ]);
  });

  it('swaps with variables and deletes with wildcards', () => {
    replay([
      [
        '() ((1 1) (2 2))',
        ['() ((1: 1 1))', '() ((2: 2 2))'],
        '(1: 1 1)\n(2: 2 2)',
      ],
      [
        '((1: 1 1) (2: 2 2)) ((1: 1 2) (2: 2 1))',
        ['((1: 1 1)) ((1: 1 2))', '((2: 2 2)) ((2: 2 1))'],
        '(1: 1 2)\n(2: 2 1)',
      ],
      [
        '((($index: $source $target)) (($index: $target $source)))',
        ['((1: 1 2)) ((1: 2 1))', '((2: 2 1)) ((2: 1 2))'],
        '(1: 2 1)\n(2: 1 2)',
      ],
      ['((* *)) ()', ['((1: 2 1)) ()', '((2: 1 2)) ()'], ''],
    ]);
  });

  it('creates nested links and names with autoCreate', () => {
    replay(
      [
        [
          '() (((m a) (a m)))',
          [
            '() ((1: 1 1))',
            '() ((2: 2 2))',
            '() ((3: 1 2))',
            '() ((4: 2 1))',
            '() ((5: 3 4))',
          ],
          '(m: m m)\n(a: a a)\n(3: m a)\n(4: a m)\n(5: 3 4)',
        ],
      ],
      { autoCreate: true }
    );
    replay(
      [
        [
          '() ((p: x y))',
          ['() ((1: 2 3))', '() ((2: 2 2))', '() ((3: 3 3))'],
          '(p: x y)\n(x: x x)\n(y: y y)',
        ],
        [
          '() ((p: x y))',
          ['((1: 2 3)) ((1: 2 3))'],
          '(p: x y)\n(x: x x)\n(y: y y)',
        ],
        [
          '((p: x y)) ((p: y x))',
          ['((1: 2 3)) ((1: 3 2))'],
          '(p: y x)\n(x: x x)\n(y: y y)',
        ],
        ['((p: * *)) ()', ['((1: 3 2)) ()'], '(x: x x)\n(y: y y)'],
      ],
      { autoCreate: true }
    );
  });

  it('changes nothing when a query fails', () => {
    const { links, names } = replay([
      ['() ((1 1))', ['() ((1: 1 1))'], '(1: 1 1)'],
    ]);
    const context = { links, names };
    expect(errorCode(() => runQuery(context, '((1: 1 1)) ((1: 1 7))'))).toBe(
      'not-found'
    );
    expect(linksToLino(links)).toBe('(1: 1 1)');
    expect(
      errorCode(() =>
        transact(context, (store) => {
          store.update(1, 0, 0);
          store.update(9, 0, 0);
        })
      )
    ).toBe('not-found');
    expect(linksToLino(links)).toBe('(1: 1 1)');
    // A name nothing has matches nothing.
    expect(runQuery(context, '((x: 1 1)) ()')).toEqual([]);
  });
});
