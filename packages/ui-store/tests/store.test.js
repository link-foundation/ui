/**
 * The read and write API of `createStore`.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse, SPEC_VERSION } from '@link-foundation/ui-core';
import {
  createStore,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_ORIGIN,
  StoreError,
} from '@link-foundation/ui-store';
import { errorCode, shape } from './helpers.js';

const TEXT = `(screen: column
  (title: text Hello)
  (ok: button (label 'OK') (variant filled)))
(text Footer)
(note x)
`;

describe('createStore: reading', () => {
  const store = createStore({ text: TEXT });

  it('keeps element ids and generates IDs for anonymous elements', () => {
    expect(store.roots()).toEqual(['screen', '_1']);
    expect(store.children('screen')).toEqual(['title', 'ok']);
    expect(store.parentOf('ok')).toBe('screen');
    expect(store.parentOf('screen')).toBeNull();
    expect(store.indexOf('ok')).toBe(1);
    expect(store.has('_1')).toBe(true);
    expect(store.has('nothing')).toBe(false);
  });

  it('gives frozen element views', () => {
    const ok = store.get('ok');
    expect(ok).toEqual({
      id: 'ok',
      name: 'ok',
      kind: 'button',
      positional: [],
      properties: [
        { name: 'label', values: ['OK'] },
        { name: 'variant', values: ['filled'] },
      ],
      unknown: [],
      parentId: 'screen',
    });
    expect(Object.isFrozen(ok)).toBe(true);
    expect(Object.isFrozen(ok.properties[0].values)).toBe(true);
    expect(store.get('_1').name).toBeNull();
    expect(store.get('missing')).toBeUndefined();
  });

  it('gives the document back', () => {
    const doc = store.toDocument();
    expect(doc.spec).toBe(SPEC_VERSION);
    expect(doc.diagnostics).toEqual([]);
    expect(shape(doc)).toEqual(shape(parse(TEXT)));
    expect([...doc.byId.keys()]).toEqual(['screen', 'title', 'ok']);
    expect(store.toLino({ style: 'inline' })).toBe(
      '(screen: column (title: text Hello) (ok: button (label OK) (variant filled)))\n(text Footer)\n(note x)\n'
    );
  });

  it('starts empty, from a document, and rejects duplicate ids', () => {
    expect(createStore().roots()).toEqual([]);
    expect(createStore().toLino()).toBe('');
    const fromDoc = createStore({ document: parse(TEXT) });
    expect(fromDoc.toLino()).toBe(store.toLino());
    expect(errorCode(() => createStore({ text: '(a: text)\n(a: text)' }))).toBe(
      'UiParseError'
    );
    expect(
      errorCode(() =>
        createStore({
          document: {
            roots: [
              { id: 'a', kind: 'x' },
              { id: 'a', kind: 'y' },
            ],
          },
        })
      )
    ).toBe('duplicate-id');
  });

  it('exports its defaults', () => {
    expect(DEFAULT_HISTORY_LIMIT).toBe(500);
    expect(DEFAULT_ORIGIN).toBe('user');
    expect(new StoreError('bad-op', 'm').code).toBe('bad-op');
  });
});

describe('createStore: writing', () => {
  it('inserts, appends and returns the new ID', () => {
    const store = createStore({ text: TEXT });
    expect(store.insert('screen', 0, { kind: 'text', positional: ['A'] })).toBe(
      '_2'
    );
    expect(store.insert('screen', undefined, { id: 'z', kind: 'text' })).toBe(
      'z'
    );
    expect(store.children('screen')).toEqual(['_2', 'title', 'ok', 'z']);
    expect(store.get('_2').positional).toEqual(['A']);
  });

  it('removes subtrees and moves elements', () => {
    const store = createStore({ text: TEXT });
    store.move('ok', null, 0);
    expect(store.roots()).toEqual(['ok', 'screen', '_1']);
    expect(store.parentOf('ok')).toBeNull();
    store.move('ok', 'screen');
    expect(store.children('screen')).toEqual(['title', 'ok']);
    store.remove('screen');
    expect(store.roots()).toEqual(['_1']);
    expect(store.has('title')).toBe(false);
  });

  it('sets and removes properties, last one wins', () => {
    const store = createStore({
      document: {
        roots: [
          {
            id: 'a',
            kind: 'text',
            properties: [
              { name: 'gap', values: ['1'] },
              { name: 'gap', values: ['2'] },
            ],
          },
        ],
      },
    });
    store.setProp('a', 'gap', ['3']);
    expect(store.get('a').properties).toEqual([
      { name: 'gap', values: ['1'] },
      { name: 'gap', values: ['3'] },
    ]);
    store.setProp('a', 'label', ['Hi', ['b', 'c']]);
    store.removeProp('a', 'gap');
    expect(store.get('a').properties).toEqual([
      { name: 'gap', values: ['1'] },
      { name: 'label', values: ['Hi', ['b', 'c']] },
    ]);
  });

  it('renames: the only operation that changes an ID', () => {
    const store = createStore({ text: TEXT });
    expect(store.rename('ok', 'cancel')).toBe('cancel');
    expect(store.children('screen')).toEqual(['title', 'cancel']);
    expect(store.rename('cancel', null)).toBe('_2');
    expect(store.get('_2').name).toBeNull();
    expect(store.rename('screen', 'main')).toBe('main');
    expect(store.parentOf('title')).toBe('main');
    expect(store.toLino({ style: 'inline' })).toBe(
      '(main: column (title: text Hello) (button (label OK) (variant filled)))\n(text Footer)\n(note x)\n'
    );
  });

  it('applies operations given as data', () => {
    const store = createStore({ text: TEXT });
    const op = store.apply({
      op: 'insert',
      parentId: null,
      node: { kind: 'text' },
    });
    expect(op).toEqual({
      op: 'insert',
      parentId: null,
      index: 2,
      node: {
        id: null,
        kind: 'text',
        positional: [],
        properties: [],
        children: [],
        unknown: [],
      },
      ids: ['_2'],
    });
  });

  it('rejects bad operations with a StoreError code and changes nothing', () => {
    const store = createStore({ text: TEXT });
    const before = store.toLino();
    const cases = [
      [() => store.remove('missing'), 'unknown-id'],
      [() => store.insert('missing', 0, { kind: 'text' }), 'unknown-id'],
      [() => store.insert(null, 0, { id: 'ok', kind: 'text' }), 'duplicate-id'],
      [() => store.insert(null, 9, { kind: 'text' }), 'bad-index'],
      [() => store.insert(null, -1, { kind: 'text' }), 'bad-index'],
      [() => store.insert(null, 0, { kind: 7 }), 'bad-node'],
      [() => store.insert(null, 0, {}), 'bad-node'],
      [() => store.move('screen', 'ok', 0), 'cycle'],
      [() => store.move('screen', 'screen', 0), 'cycle'],
      [() => store.move('ok', 'screen', 2), 'bad-index'],
      [() => store.removeProp('ok', 'gap'), 'unknown-property'],
      [() => store.setProp('ok', 'gap', 'x'), 'bad-value'],
      [() => store.setProp('ok', 'gap', [{ id: 1 }]), 'bad-value'],
      [() => store.rename('ok', 'title'), 'duplicate-id'],
      [() => store.rename('ok', ''), 'bad-op'],
      [() => store.apply({ op: 'explode' }), 'bad-op'],
      [() => store.apply({ op: 'remove' }), 'bad-op'],
    ];
    for (const [fn, code] of cases) {
      expect(errorCode(fn)).toBe(code);
    }
    expect(store.toLino()).toBe(before);
    expect(store.log()).toEqual([]);
  });

  it('reads with parse options', () => {
    expect(
      errorCode(() =>
        createStore({ text: '(a (b (c)))', parseOptions: { maxDepth: 1 } })
      )
    ).toBe('UiParseError');
  });
});
