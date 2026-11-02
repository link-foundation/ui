/**
 * Conformance runner over the ui-dialect/0 fixtures (docs/spec/fixtures/):
 * every `.tree.json` equals `toTree(parse(text))`, every `.diagnostics.json`
 * lists the diagnostics of `parse(text)`. Diagnostic order is not
 * significant (docs/spec/limits.md), so diagnostics are compared sorted.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse, toTree } from '@link-foundation/ui-core';
import { sortedDiagnostics, specFixtures } from './helpers.js';

const fixtures = specFixtures();

describe('ui-dialect/0 conformance fixtures', () => {
  it('finds the fixtures of every area', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(50);
    for (const { name, tree, diagnostics } of fixtures) {
      expect([name, tree !== undefined || diagnostics !== undefined]).toEqual([
        name,
        true,
      ]);
    }
  });

  for (const { name, text, tree, diagnostics } of fixtures) {
    it(name, () => {
      const actual = toTree(parse(text));
      const expected = tree ?? diagnostics;
      expect(sortedDiagnostics(actual.diagnostics)).toEqual(
        sortedDiagnostics(expected.diagnostics)
      );
      if (tree) {
        const withoutDiagnostics = (value) => ({ ...value, diagnostics: [] });
        expect(withoutDiagnostics(actual)).toEqual(withoutDiagnostics(tree));
        // The tree JSON is byte-equal, not only deep-equal.
        expect(JSON.stringify({ ...actual, diagnostics: [] })).toBe(
          JSON.stringify({ ...tree, diagnostics: [] })
        );
      }
    });
  }
});
