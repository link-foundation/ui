/**
 * A2UI interop: the official v0.9.1 basic catalog examples round-trip, the
 * LiNo is stable, and the incremental diffs build the same tree as a whole
 * import after every message.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  A2UI_VERSION,
  A2uiStream,
  a2uiMessagesToDiffs,
  applyA2uiDiffs,
  exportA2ui,
  importA2ui,
  normalizeA2ui,
} from '../src/index.js';
import { codes, errors, fixture, fixtureNames, reformat } from './helpers.js';

const messagesOf = (name) => fixture('a2ui', name).messages;

describe('A2UI fixtures', () => {
  for (const name of fixtureNames('a2ui')) {
    const messages = messagesOf(name);
    const imported = importA2ui(messages);

    it(`${name}: export(import(x)) deep-equals normalizeA2ui(x)`, () => {
      expect(errors(imported.diagnostics)).toEqual([]);
      const exported = exportA2ui(imported.lino);
      expect(errors(exported.diagnostics)).toEqual([]);
      expect(exported.json).toEqual(normalizeA2ui(messages));
    });

    it(`${name}: serialize(parse(lino)) is stable`, () => {
      expect(reformat(imported.lino)).toBe(imported.lino);
    });

    it(`${name}: the diffs after each message equal a whole import`, () => {
      const stream = new A2uiStream();
      let tree = [];
      messages.forEach((message, i) => {
        tree = applyA2uiDiffs(tree, stream.push(message).diffs);
        expect(tree).toEqual(importA2ui(messages.slice(0, i + 1)).roots);
      });
    });
  }
});

describe('A2UI messages', () => {
  const create = { version: 'v0.9', createSurface: { surfaceId: 's' } };
  const update = (components) => ({
    version: 'v0.9',
    updateComponents: { surfaceId: 's', components },
  });

  it('names the protocol version', () => {
    expect(A2UI_VERSION).toBe('0.9.1');
  });

  it('a2uiMessagesToDiffs inserts, sets and removes elements', () => {
    const text = (value) => ({ id: 'root', component: 'Text', text: value });
    const { diffs } = a2uiMessagesToDiffs([
      create,
      update([text('Hello')]),
      update([text('Bye')]),
      { version: 'v0.9', deleteSurface: { surfaceId: 's' } },
    ]);
    expect(diffs.map((d) => `${d.op} ${d.id}`)).toEqual([
      'insert s',
      'insert root',
      'set root',
      'remove s',
    ]);
    expect(diffs[1].parent).toBe('s');
    expect(diffs[1].kind).toBe('text');
    expect(diffs[2].props.positional).toEqual(['Bye']);
  });

  it('keeps unknown component keys in extra', () => {
    const messages = [
      create,
      update([
        { id: 'root', component: 'Text', text: 'Hi', future: { a: [1, 2] } },
      ]),
    ];
    const { lino } = importA2ui(messages);
    expect(lino).toContain('(extra a2ui');
    expect(exportA2ui(lino).json).toEqual(messages);
  });

  it('accepts JSON Lines and the { messages } sample shape', () => {
    const messages = messagesOf('simple-text.json');
    const jsonl = messages.map((m) => JSON.stringify(m)).join('\n');
    expect(importA2ui(jsonl).lino).toBe(importA2ui(messages).lino);
    expect(importA2ui({ messages }).lino).toBe(importA2ui(messages).lino);
  });

  it('reports bad messages and unsafe data paths', () => {
    const { diagnostics } = importA2ui([
      create,
      { version: 'v0.9', updateDataModel: { surfaceId: 's', path: 'x' } },
      {
        version: 'v0.9',
        updateDataModel: { surfaceId: 's', path: '/__proto__/x', value: 1 },
      },
      { version: 'v0.9', updateComponents: { surfaceId: 'nope' } },
      { neither: true },
    ]);
    expect(codes(diagnostics)).toEqual([
      'invalid-path',
      'unsafe-path',
      'unknown-surface',
      'invalid-message',
    ]);
    expect({}.x).toBeUndefined();
  });

  it('keeps unsupported components as opaque elements', () => {
    const { lino, diagnostics } = importA2ui(messagesOf('coverage.json'));
    expect(codes(diagnostics)).toContain('unsupported-component');
    expect(lino).toContain('opaque');
  });
});
