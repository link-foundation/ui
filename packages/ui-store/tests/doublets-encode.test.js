/**
 * A UI document as doublets and back (src/doublets/encode.js).
 */

import { deepStrictEqual } from 'node:assert';
import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import {
  createStore,
  decodeDocument,
  encodeDocument,
} from '@link-foundation/ui-store';
import {
  errorCode,
  samples,
  seededRandom,
  randomOp,
  shape,
} from './helpers.js';

/** The checks of the issue on every triple. */
function checkTriples({ links, names }) {
  const points = new Set(names.values());
  const pairs = new Set();
  links.forEach((link, i) => {
    expect(link.index).toBe(i + 1);
    for (const part of [link.index, link.source, link.target]) {
      expect(Number.isInteger(part) && part >= 1).toBe(true);
    }
    if (points.has(link.index)) {
      expect([link.source, link.target]).toEqual([link.index, link.index]);
      return;
    }
    const key = `${link.source} ${link.target}`;
    expect(pairs.has(key)).toBe(false);
    expect(points.has(link.source) && link.source === link.target).toBe(false);
    pairs.add(key);
  });
  expect(points.size).toBe(names.size);
}

const roundtrip = (doc) => {
  const encoded = encodeDocument(doc);
  checkTriples(encoded);
  return decodeDocument(encoded);
};

describe('doublets encoding', () => {
  for (const { name, text } of samples()) {
    it(`${name}: decodeDocument(encodeDocument(doc)) deep-equals doc`, () => {
      const doc = createStore({ text }).toDocument();
      deepStrictEqual(roundtrip(doc), doc);
      expect(shape(roundtrip(parse(text)))).toEqual(shape(parse(text)));
    });
  }

  it('keeps values, empty lists and the words of the encoding itself', () => {
    const doc = {
      roots: [
        {
          id: 'list',
          kind: 'end',
          positional: ['list', 'end'],
          properties: [
            { name: 'label', values: ['label'] },
            { name: 'empty', values: [] },
            {
              name: 'nested',
              values: [[], ['a', ['b']], { id: 'x', values: [] }],
            },
          ],
          children: [
            {
              id: null,
              kind: null,
              positional: [],
              properties: [],
              children: [],
              unknown: ['raw'],
            },
          ],
          unknown: [{ id: 'list', values: ['end'] }],
        },
      ],
      unknown: [['top', 'level'], 'word', []],
    };
    expect(shape(roundtrip(doc))).toEqual(doc);
    expect(shape(roundtrip({ roots: [], unknown: [] }))).toEqual({
      roots: [],
      unknown: [],
    });
  });

  it('deduplicates: a repeated subtree is stored once', () => {
    const one = encodeDocument(parse('(stack (text a))\n'));
    const two = encodeDocument(parse('(stack (text a))\n(stack (text a))\n'));
    expect(two.links.length).toBe(one.links.length + 1);
    expect(two.names).toEqual(one.names);
  });

  it('round-trips a document after 200 seeded edits', () => {
    const store = createStore({ text: samples()[0].text });
    const rand = seededRandom(17);
    for (let n = 0; n < 200; n++) {
      randomOp(store, rand, n);
    }
    deepStrictEqual(roundtrip(store.toDocument()), store.toDocument());
  });

  it('rejects doublets that are not in the encoding', () => {
    const encoded = encodeDocument(parse("(ok: button (label 'OK'))\n"));
    const without = (index) => ({
      ...encoded,
      links: encoded.links.filter((link) => link.index !== index),
    });
    expect(errorCode(() => decodeDocument(without(encoded.roots[0])))).toBe(
      'bad-doublets'
    );
    expect(
      errorCode(() => decodeDocument({ ...encoded, roots: [encoded.roots[0]] }))
    ).toBe('bad-doublets');
    expect(
      errorCode(() =>
        decodeDocument({
          ...encoded,
          links: [...encoded.links, { index: 0, source: 0, target: 0 }],
        })
      )
    ).toBe('bad-doublets');
    const cyclic = encoded.links.map((link) =>
      link.index === encoded.roots[0]
        ? { ...link, source: link.index + 1 }
        : link
    );
    expect(errorCode(() => decodeDocument({ ...encoded, links: cyclic }))).toBe(
      'bad-doublets'
    );
  });
});
