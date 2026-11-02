/**
 * References of docs/spec/values.md: `(token a.b)`, `(param a.b)`,
 * `(or a b c)` and the reserved `@x` / `$x` sigils (#15).
 */

import { describe, it, expect } from 'test-anywhere';
import { values } from '@link-foundation/ui-core';
import { checkTyped } from './helpers.js';

const typed = (raw, type, expected) =>
  checkTyped(values, raw, { type }, expected, (a, b) => expect(a).toEqual(b));

const token = (path) => ({ type: 'token-ref', path });
const px = (value) => ({ type: 'dimension', value, unit: 'px' });

describe('values: references', () => {
  it('types (token color.primary) as a token reference', () => {
    typed(['token', 'color.primary'], 'color', token('color.primary'));
    typed(['token', 'space.medium'], 'dimension', token('space.medium'));
    typed(['param', 'draft.text'], 'string', {
      type: 'param',
      path: 'draft.text',
    });
  });

  it('gives var(--color-primary) as CSS', () => {
    const { value } = values.typeValue(['token', 'color.primary'], {
      type: 'color',
    });
    expect(values.toCss(value)).toBe('var(--color-primary)');
    expect(values.toCss({ type: 'param', path: 'draft.text' })).toBe(
      'var(--param-draft-text)'
    );
  });

  it('types every option of (or ...) with the property type', () => {
    typed(
      ['or', ['token', 'space.large'], ['token', 'space.medium'], '8px'],
      'dimension',
      {
        type: 'fallback',
        options: [token('space.large'), token('space.medium'), px(8)],
      }
    );
    const { value } = values.typeValue(
      ['or', ['token', 'space.large'], ['token', 'space.medium'], '8px'],
      { type: 'dimension' }
    );
    expect(values.toCss(value)).toBe(
      'var(--space-large, var(--space-medium, 8px))'
    );
  });

  it('lets toCss map references with refToVar', () => {
    const value = { type: 'fallback', options: [token('a.b'), px(4)] };
    const refToVar = (ref, fallback) =>
      `ref(${ref.path}${fallback === undefined ? '' : `|${fallback}`})`;
    expect(values.toCss(value, { refToVar })).toBe('ref(a.b|4px)');
  });

  it('rejects malformed references with invalid-value', () => {
    for (const raw of [
      ['token'],
      ['token', 'a', 'b'],
      ['param'],
      ['or', ['token', 'a'], '16pt'],
    ]) {
      const { value, diagnostics } = values.typeValue(raw, {
        type: 'dimension',
      });
      expect([raw, value, diagnostics.map((d) => d.code)]).toEqual([
        raw,
        null,
        ['invalid-value'],
      ]);
    }
  });

  it('reports @color.primary and $draft.text as reserved-sigil', () => {
    for (const raw of ['@color.primary', '$draft.text']) {
      const at = { element: 'card', property: 'gap' };
      const { value, diagnostics } = values.typeValue(
        raw,
        { type: 'dimension' },
        { at }
      );
      expect(value).toEqual({ type: 'string', value: raw });
      expect(
        diagnostics.map(({ code, severity, at: where }) => ({
          code,
          severity,
          at: where,
        }))
      ).toEqual([{ code: 'reserved-sigil', severity: 'warning', at }]);
    }
  });

  it('finds sigils inside nested links', () => {
    const diagnostics = values.sigilDiagnostics(['or', '@a', ['token', '$b']]);
    expect(diagnostics.map((d) => d.code)).toEqual([
      'reserved-sigil',
      'reserved-sigil',
    ]);
  });

  it('tells references from other links', () => {
    expect(values.isReference(['token', 'a'])).toBe(true);
    expect(values.isReference(['or', 'a', 'b'])).toBe(true);
    expect(values.isReference(['rgb', '1', '2', '3'])).toBe(false);
    expect(values.isReference('token')).toBe(false);
  });
});
