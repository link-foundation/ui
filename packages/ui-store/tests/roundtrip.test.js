/**
 * Text in, text out: a store gives back the document it was created with.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { samples, shape } from './helpers.js';

describe('roundtrip', () => {
  const all = samples();

  it('finds the samples of the issue-1 case study', () => {
    expect(all.length).toBeGreaterThanOrEqual(7);
  });

  for (const { name, text } of all) {
    it(`${name}: toLino() parses to the same tree`, () => {
      const parsed = parse(text);
      expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual(
        []
      );
      const store = createStore({ text });
      for (const style of ['multiline', 'inline', 'indented']) {
        expect(shape(parse(store.toLino({ style })))).toEqual(shape(parsed));
      }
      expect(shape(store.toDocument())).toEqual(shape(parsed));
      expect(createStore({ text: store.toLino() }).toLino()).toBe(
        store.toLino()
      );
    });
  }
});
