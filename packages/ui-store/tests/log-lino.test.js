/**
 * The operation log as Links Notation.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore, logFromLino, logToLino } from '@link-foundation/ui-store';
import { errorCode, randomOp, samples, seededRandom } from './helpers.js';

const TEXT = "(ok: button (label 'OK'))\n(stack (text a) (text b))\n";

/** Plain JSON copy (no frozen objects, no undefined keys). */
const json = (value) => JSON.parse(JSON.stringify(value));

describe('log as Links Notation', () => {
  it('writes the format of the issue', () => {
    const store = createStore({ text: TEXT });
    store.transaction(
      'Edit label',
      () => store.setProp('ok', 'label', ['Cancel']),
      { origin: 'devmode' }
    );
    store.undo();
    expect(logToLino(store.log())).toBe(
      "(tx 1 (origin devmode) (label 'Edit label') (setProp ok label Cancel))\n" +
        '(tx 2 (origin undo) (undoes 1) (setProp ok label OK))\n'
    );
  });

  it('writes every operation form', () => {
    const store = createStore({ text: TEXT });
    store.insert('_1', 1, {
      id: 'n',
      kind: 'text',
      positional: ['x y'],
      properties: [{ name: 'value', values: ['v', ['a', 'b']] }],
      unknown: [['glow', '2']],
      children: [{ kind: 'text' }],
    });
    store.move('n', null, 0);
    store.removeProp('ok', 'label');
    store.undo();
    store.rename('ok', null);
    store.rename('_5', 'ok2');
    store.remove('_1');
    expect(logToLino(store.log())).toBe(
      [
        "(tx 1 (origin user) (insert (parent _1) (at 1) (ids n _4) (node (id n) (kind text) (positional 'x y') (properties (value v (a b))) (unknown (glow 2)) (children (node (kind text))))))",
        '(tx 2 (origin user) (move n (at 0)))',
        '(tx 3 (origin user) (removeProp ok label))',
        '(tx 4 (origin undo) (undoes 3) (setProp (at 0) ok label OK))',
        '(tx 5 (origin user) (rename ok (anonymous _5)))',
        '(tx 6 (origin user) (rename _5 ok2))',
        '(tx 7 (origin user) (remove _1))',
        '',
      ].join('\n')
    );
    expect(json(logFromLino(logToLino(store.log())))).toEqual(
      json(store.log())
    );
  });

  for (const [seed, sample] of [
    [4, null],
    [5, 'document.lino'],
    [6, 'tokens.lino'],
  ]) {
    it(`seed ${seed}: reads back what it writes, and replays to the same document`, () => {
      const text = sample
        ? samples().find((s) => s.name === sample).text
        : TEXT;
      const store = createStore({ text });
      const rand = seededRandom(seed);
      for (let n = 0; n < 150; n++) {
        if (n % 3 === 0) {
          store.transaction(`step ${n}`, () => {
            randomOp(store, rand, n);
            randomOp(store, rand, n + 1000);
          });
        } else {
          randomOp(store, rand, n);
        }
        if (rand() < 0.15) {
          store.undo();
        }
        if (rand() < 0.05) {
          store.redo();
        }
      }
      const log = store.log();
      const lino = logToLino(log);
      const read = logFromLino(lino);
      expect(read).toEqual(json(log));
      expect(logToLino(read)).toBe(lino);

      const replica = createStore({ text });
      replica.replay(read);
      expect(replica.toLino()).toBe(store.toLino());
      expect(json(replica.log())).toEqual(json(log).map(stripHistory));
    });
  }

  it('replays a log entry by entry with its origin and label', () => {
    const store = createStore({ text: TEXT });
    store.transaction('A', () => store.setProp('ok', 'label', ['A']), {
      origin: 'devmode',
    });
    const replica = createStore({ text: TEXT });
    const calls = [];
    replica.subscribe((events, entry) => calls.push(entry));
    replica.replay(logFromLino(logToLino(store.log())));
    expect(calls.map((e) => [e.tx, e.origin, e.label])).toEqual([
      [1, 'devmode', 'A'],
    ]);
    expect(replica.canUndo()).toBe(true);
  });

  it('rejects text that is not a log', () => {
    const cases = [
      'x',
      '(tx)',
      '(tx 1 (setProp a b))',
      '(tx one (origin user))',
      '(tx 01 (origin user))',
      '(tx 1 (origin user) (explode a))',
      '(tx 1 (origin user) (origin user))',
      '(tx 1 (origin user) (remove a b))',
      '(tx 1 (origin user) (move a))',
      '(tx 1 (origin user) (move a (at x)))',
      '(tx 1 (origin user) (setProp a))',
      '(tx 1 (origin user) (removeProp a b c))',
      '(tx 1 (origin user) (rename a))',
      '(tx 1 (origin user) (insert (at 0) (ids a)))',
      '(tx 1 (origin user) (insert (at 0) (ids a) (node (shape x))))',
      '(tx 1 (origin user) (insert (at 0) (ids a) (node (properties x))))',
      '(tx 1 (origin user) (insert (ids a) (node (kind text))))',
    ];
    for (const text of cases) {
      expect(errorCode(() => logFromLino(text))).toBe('bad-log');
    }
    expect(errorCode(() => logFromLino('(tx 1'))).toBe('UiParseError');
    expect(logFromLino('')).toEqual([]);
  });
});

/** A replayed entry keeps origin and label, but not `undoes`/`redoes`. */
function stripHistory(entry) {
  return Object.fromEntries(
    Object.entries(entry).filter(
      ([key]) => key !== 'undoes' && key !== 'redoes'
    )
  );
}
