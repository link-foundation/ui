/**
 * The source edits change only the bytes they must: comments, blank lines
 * and layout around them are kept, and every result reads back into the
 * tree the same op gives on the parsed document.
 */

import { describe, it, expect } from 'test-anywhere';
import { stripComments } from 'links-notation';
import { parse } from '@link-foundation/ui-core';
import {
  applyEdits,
  applyOpToTree,
  insertChild,
  moveNode,
  removeNode,
  removeProp,
  renameId,
  setPositional,
  setProp,
} from '@link-foundation/ui-core/source';
import { commentsOf, shape, sourceFixtures } from './helpers.js';

const comments = (text) => commentsOf(text, stripComments);
const sorted = (list) => [...list].sort();
const fixture = (name) =>
  sourceFixtures().find((f) => f.name === `${name}.lino`).text;

const EXAMPLE =
  "# primary action\n(ok: button\n  (label 'OK')   # shown on the button\n  (variant filled))\n";

/** The result is ok, applies its own edits and reads back to the op's tree. */
function expectEdit(text, result, op) {
  expect(result.ok, result.error).toBe(true);
  expect(applyEdits(text, result.edits)).toBe(result.text);
  const expected = applyOpToTree(parse(text), op);
  expect(shape(parse(result.text))).toEqual(expected.tree);
}

describe('the example of the issue', () => {
  it('changes the label with exactly one edit', () => {
    const result = setProp(EXAMPLE, 'ok', 'label', ['Cancel']);
    expect(result.ok).toBe(true);
    expect(result.edits).toEqual([{ start: 38, end: 42, insert: "'Cancel'" }]);
    expect(result.text.slice(0, 38)).toBe(EXAMPLE.slice(0, 38));
    expect(result.text.slice(46)).toBe(EXAMPLE.slice(42));
    expect(comments(result.text)).toEqual(comments(EXAMPLE));
  });
});

// The same document in the three forms; `body` holds greeting, ok and cancel.
const FORMS = [
  {
    form: 'one-line',
    child: '(extra: text Extra)',
    greetingComments: [],
  },
  {
    form: 'multiline',
    child: '(extra: text Extra)',
    greetingComments: ['# A greeting first.'],
  },
  {
    form: 'indented',
    child: 'extra: text Extra',
    greetingComments: ['# A greeting first.'],
  },
];

for (const { form, child, greetingComments } of FORMS) {
  describe(`edits in the ${form} form`, () => {
    const text = fixture(`form.${form}`);
    const before = comments(text);

    it('has comments to keep', () => {
      expect(before.length > 1).toBe(true);
    });

    it('inserts a child', () => {
      const result = insertChild(text, 'body', 1, child);
      const node = parse(child).roots[0];
      expectEdit(text, result, {
        op: 'insert',
        parentId: 'body',
        index: 1,
        node,
      });
      expect(comments(result.text)).toEqual(before);
      expect(result.edits.length).toBe(1);
      expect(result.edits[0].end).toBe(result.edits[0].start);
    });

    it('removes a node with the comment above it', () => {
      const result = removeNode(text, 'greeting');
      expectEdit(text, result, { op: 'remove', id: 'greeting' });
      const left = before.filter((c) => !greetingComments.includes(c));
      expect(comments(result.text)).toEqual(left);
      expect(result.text.includes('Hello, links')).toBe(false);
    });

    it('moves a node with the comment above it', () => {
      const result = moveNode(text, 'greeting', 'body', 2);
      expectEdit(text, result, {
        op: 'move',
        id: 'greeting',
        parentId: 'body',
        index: 2,
      });
      expect(sorted(comments(result.text))).toEqual(sorted(before));
      for (const comment of greetingComments) {
        const at = result.text.indexOf(comment);
        expect(result.text.indexOf('greeting:', at) > at).toBe(true);
      }
    });

    it('moves a node to another parent', () => {
      const result = moveNode(text, 'ok', 'app', 0);
      expectEdit(text, result, {
        op: 'move',
        id: 'ok',
        parentId: 'app',
        index: 0,
      });
      expect(sorted(comments(result.text))).toEqual(sorted(before));
    });

    it('renames the definition only', () => {
      const result = renameId(text, 'ok', 'confirm');
      expectEdit(text, result, { op: 'rename', id: 'ok', to: 'confirm' });
      expect(comments(result.text)).toEqual(before);
      expect(result.edits.length).toBe(1);
      expect(result.edits[0].insert).toBe('confirm');
    });
  });
}

describe('layout of new text', () => {
  it('inserts inline with one space in the one-line form', () => {
    const text = '(app: document (h: text Title) (b: button (label Go)))\n';
    const result = insertChild(text, 'app', 1, '(x: text X)');
    expect(result.text).toBe(
      '(app: document (h: text Title) (x: text X) (b: button (label Go)))\n'
    );
  });

  it('reuses the indentation of the nearest sibling', () => {
    const text = 'app: stack\n    a: text A\n    b: text B\n';
    const result = insertChild(text, 'app', 1, 'x: text X');
    expect(result.text).toBe(
      'app: stack\n    a: text A\n    x: text X\n    b: text B\n'
    );
  });

  it('quotes a new value that needs it', () => {
    const result = setProp('(ok: button (label OK))', 'ok', 'label', [
      'Say hi (now)',
    ]);
    expect(result.text).toBe("(ok: button (label 'Say hi (now)'))");
  });

  it('keeps CRLF line breaks', () => {
    const text =
      "# c\r\n(ok: button\r\n  (label 'OK') # x\r\n  (v: text V))\r\n";
    const changed = setProp(text, 'ok', 'label', ['Cancel']);
    expect(changed.text).toBe(text.replace("'OK'", "'Cancel'"));
    const inserted = insertChild(text, 'ok', 1, '(t: text Hi)');
    expect(inserted.ok, inserted.error).toBe(true);
    expect(inserted.text.split('\r\n').join('').includes('\n')).toBe(false);
  });

  it('removes the empty line a removed node leaves', () => {
    const text = '(app: stack\n  (a: text A)\n  (b: text B))\n';
    expect(removeNode(text, 'a').text).toBe('(app: stack\n  (b: text B))\n');
  });

  it('keeps the blank lines around other nodes', () => {
    const text = fixture('blank-lines.multiline');
    const result = removeNode(text, 'three');
    expect(result.ok, result.error).toBe(true);
    expect(result.text.startsWith(text.slice(0, text.indexOf('(two')))).toBe(
      true
    );
    expect(result.text.endsWith('\n\n\n\n')).toBe(true);
  });
});

describe('property edits', () => {
  it('appends a new property', () => {
    const result = setProp(EXAMPLE, 'ok', 'disabled', ['true']);
    expectEdit(EXAMPLE, result, {
      op: 'setProp',
      id: 'ok',
      name: 'disabled',
      values: ['true'],
    });
    expect(comments(result.text)).toEqual(comments(EXAMPLE));
  });

  it('removes a property', () => {
    const result = removeProp(EXAMPLE, 'ok', 'variant');
    expectEdit(EXAMPLE, result, {
      op: 'removeProp',
      id: 'ok',
      name: 'variant',
    });
    expect(comments(result.text)).toEqual(comments(EXAMPLE));
  });

  it('sets the positional values', () => {
    const result = setPositional('(a: text A)', 'a', ['Hello there']);
    expect(result.text).toBe("(a: text 'Hello there')");
  });

  it('sets a note on any kind', () => {
    const result = setProp(EXAMPLE, 'ok', 'note', ['Why this is red']);
    expect(result.ok, result.error).toBe(true);
    const node = parse(result.text).byId.get('ok');
    expect(node.properties.at(-1)).toEqual({
      name: 'note',
      values: ['Why this is red'],
    });
  });
});

describe('references and refusals', () => {
  it('reports the references a rename leaves', () => {
    const text = '(a: stack (b: text T) (c: text (for b)))\n(b2: text b)';
    const result = renameId(text, 'b', 'bb');
    expect(result.text.slice(0, 22)).toBe('(a: stack (bb: text T)');
    expect(
      result.references.map(({ start, end }) => result.text.slice(start, end))
    ).toEqual(['b', 'b']);
  });

  const refusals = {
    'a missing id': () => removeNode(EXAMPLE, 'zz'),
    'a duplicate id': () => renameId('(a: stack (b: text T))', 'b', 'a'),
    'a move into a descendant': () =>
      moveNode('(a: stack (b: stack))', 'a', 'b', 0),
    'an index out of range': () => insertChild(EXAMPLE, 'ok', 5, '(x: text X)'),
    'a property that is not there': () => removeProp(EXAMPLE, 'ok', 'gap'),
    // `text` has no `variant`: the parse keeps it apart, not as a property.
    'a property the kind does not have': () =>
      setProp('(a: text A)', 'a', 'variant', ['filled']),
    'a child that does not parse': () =>
      insertChild(EXAMPLE, 'ok', 0, '(x: text'),
  };
  for (const [name, edit] of Object.entries(refusals)) {
    it(`refuses ${name} and keeps the text`, () => {
      const result = edit();
      expect(result.ok).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.edits).toBeUndefined();
    });
  }
});
