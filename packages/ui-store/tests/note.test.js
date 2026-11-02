/**
 * The `note` property of link-foundation/ui#22 survives the store round trip:
 * text → store → text, the operation log written as Links Notation and
 * replayed, and undo/redo.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createStore, logFromLino, logToLino } from '@link-foundation/ui-store';

const TEXT = [
  '(app: stack',
  "  (note 'The root of the screen')",
  "  (ok: button (label 'OK') (note 'Why this is red'))",
  "  (text 'Hello' (note \"It's (still) a draft\")))",
].join('\n');

const STYLES = ['multiline', 'inline', 'indented'];

/** The notes of a document, in pre-order: `[id, values]` pairs. */
function notesOf(doc) {
  const out = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      for (const p of node.properties) {
        if (p.name === 'note') {
          out.push([node.id, p.values]);
        }
      }
      walk(node.children);
    }
  };
  walk(doc.roots);
  return out;
}

const EXPECTED = [
  ['app', ['The root of the screen']],
  ['ok', ['Why this is red']],
  [null, ["It's (still) a draft"]],
];

describe('note in the store', () => {
  it('is read from the text without diagnostics', () => {
    const doc = parse(TEXT);
    expect(doc.diagnostics).toEqual([]);
    expect(notesOf(doc)).toEqual(EXPECTED);
  });

  it('survives text → store → text in every style', () => {
    const store = createStore({ text: TEXT });
    expect(store.get('ok').properties).toEqual([
      { name: 'label', values: ['OK'] },
      { name: 'note', values: ['Why this is red'] },
    ]);
    expect(notesOf(store.toDocument())).toEqual(EXPECTED);
    for (const style of STYLES) {
      const doc = parse(store.toLino({ style }));
      expect([style, doc.diagnostics]).toEqual([style, []]);
      expect([style, notesOf(doc)]).toEqual([style, EXPECTED]);
    }
  });

  it('survives the operation log written as LiNo and replayed', () => {
    const store = createStore({ text: TEXT });
    store.transaction(
      'Explain the colour',
      () => {
        store.setProp('ok', 'note', ['Red: it deletes (no undo)']);
        store.setProp('app', 'note', ['Quotes \' and " both']);
        store.removeProp('ok', 'label');
      },
      { origin: 'devmode' }
    );
    const lino = logToLino(store.log());
    const replayed = createStore({ text: TEXT });
    replayed.replay(logFromLino(lino));
    expect(replayed.toLino()).toBe(store.toLino());
    expect(notesOf(parse(replayed.toLino()))).toEqual([
      ['app', ['Quotes \' and " both']],
      ['ok', ['Red: it deletes (no undo)']],
      [null, ["It's (still) a draft"]],
    ]);
  });

  it('is restored by undo and redo', () => {
    const store = createStore({ text: TEXT });
    const before = store.toLino();
    store.removeProp('ok', 'note');
    store.setProp('app', 'note', ['Changed']);
    const after = store.toLino();
    expect(notesOf(parse(after))).toEqual([
      ['app', ['Changed']],
      [null, ["It's (still) a draft"]],
    ]);
    store.undo();
    store.undo();
    expect(store.toLino()).toBe(before);
    store.redo();
    store.redo();
    expect(store.toLino()).toBe(after);
  });
});
